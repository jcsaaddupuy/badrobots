import { connectToSession } from "@earendil-works/gondolin";
import { PassThrough } from "node:stream";

// Control protocol message types
type ClientMessage = any;
type ServerMessage = any;

/**
 * Represents a single execution session on a remote VM
 */
interface RemoteExecSession {
  id: number;
  stdout: PassThrough;
  stderr: PassThrough;
  stdoutChunks: Buffer[];
  stderrChunks: Buffer[];
  resultPromise: Promise<ExecResult>;
  resolve: (result: ExecResult) => void;
  reject: (error: Error) => void;
  buffer: boolean;
  iterating: boolean;
}

export interface ExecResult {
  exitCode: number;
  signal?: number;
  ok: boolean;
  stdout: string;
  stderr: string;
  stdoutBuffer: Buffer;
  stderrBuffer: Buffer;
}

/**
 * Represents a streaming execution result
 */
export interface ExecProcess extends Promise<ExecResult> {
  output(): AsyncIterable<{ data: string | Buffer }>;
}

/**
 * RemoteVM wraps a connection to a remote Gondolin session via IPC socket.
 * Provides a VM-like interface for executing commands on remote VMs.
 */
export class RemoteVM {
  private socketPath: string;
  private sessionId: string;
  private connection: { send: (msg: ClientMessage) => void; close: () => void } | null = null;
  private sessions: Map<number, RemoteExecSession> = new Map();
  private messageQueue: (ClientMessage | Buffer)[] = [];
  private isConnected = false;
  private nextSessionId = 1;
  private connectPromise: Promise<void> | null = null;

  constructor(socketPath: string, sessionId: string) {
    this.socketPath = socketPath;
    this.sessionId = sessionId;
  }

  /**
   * Establish connection to remote session
   */
  async connect(): Promise<void> {
    if (this.isConnected) return;
    if (this.connectPromise) return this.connectPromise;

    this.connectPromise = this._connect();
    return this.connectPromise;
  }

  private async _connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.connection = connectToSession(this.socketPath, {
          onJson: (msg: ServerMessage) => this._handleMessage(msg),
          onBinary: (data: Buffer) => this._handleBinaryOutput(data),
          onClose: (error?: Error) => {
            this.isConnected = false;
            if (error) {
              for (const session of this.sessions.values()) {
                session.reject(new Error(`Connection closed: ${error.message}`));
              }
              this.sessions.clear();
            }
          },
        });

        this.isConnected = true;
        this.connectPromise = null;

        // Flush queued messages
        const queue = this.messageQueue;
        this.messageQueue = [];
        for (const msg of queue) {
          if (!Buffer.isBuffer(msg)) {
            this.connection!.send(msg);
          }
        }

        resolve();
      } catch (err) {
        this.connectPromise = null;
        reject(err);
      }
    });
  }

  /**
   * Execute a command on the remote VM
   */
  exec(
    command: string | string[],
    options?: {
      cwd?: string;
      env?: Record<string, string>;
      stdout?: "pipe" | "inherit";
      stderr?: "pipe" | "inherit";
      signal?: AbortSignal;
      timeout?: number;
    }
  ): ExecProcess {
    const self = this;
    const sessionId = this.nextSessionId++;
    const cmd = Array.isArray(command) ? command[0] : command;
    const argv = Array.isArray(command) ? command.slice(1) : [];

    // Convert env object to KEY=VALUE array
    const env = options?.env
      ? Object.entries(options.env).map(([k, v]) => `${k}=${v}`)
      : undefined;

    // Create streams
    const stdout = new PassThrough();
    const stderr = new PassThrough();

    // Create result promise
    let resolve: (result: ExecResult) => void;
    let reject: (error: Error) => void;
    const resultPromise = new Promise<ExecResult>((res, rej) => {
      resolve = res;
      reject = rej;
    });

    // Handle abort signal
    let timedOut = false;
    let abortListener: (() => void) | null = null;
    let timer: NodeJS.Timeout | null = null;

    if (options?.signal) {
      abortListener = () => {
        reject(new Error("aborted"));
      };
      options.signal.addEventListener("abort", abortListener);
    }

    if (options?.timeout && options.timeout > 0) {
      timer = setTimeout(() => {
        timedOut = true;
        reject(new Error(`timeout:${options.timeout}`));
      }, options.timeout * 1000);
    }

    // Create session
    const session: RemoteExecSession = {
      id: sessionId,
      stdout,
      stderr,
      stdoutChunks: [],
      stderrChunks: [],
      resultPromise,
      resolve: (result) => {
        if (timer) clearTimeout(timer);
        if (options?.signal && abortListener) {
          options.signal.removeEventListener("abort", abortListener);
        }
        resolve(result);
      },
      reject: (error) => {
        if (timer) clearTimeout(timer);
        if (options?.signal && abortListener) {
          options.signal.removeEventListener("abort", abortListener);
        }
        reject(error);
      },
      buffer: true,
      iterating: false,
    };

    this.sessions.set(sessionId, session);

    // Send exec message asynchronously
    (async () => {
      try {
        await self.connect();
        
        // Small delay to ensure socket is ready
        await new Promise(resolve => setTimeout(resolve, 10));
        
        // Alpine Linux uses /bin/sh, not /bin/bash
        // Replace /bin/bash with /bin/sh for compatibility
        let finalCmd = cmd;
        let finalArgv = [...argv]; // Make a copy
        let finalEnv = env ? [...env] : [];
        

        
        if (cmd === "/bin/bash") {
          finalCmd = "/bin/sh";
          
          // For Alpine sh, we need to use -c instead of -lc
          // -lc tries to load login shell which may not work in remote context
          if (finalArgv.length >= 1 && finalArgv[0] === "-lc") {
            finalArgv[0] = "-c";
          }
          
          // Ensure PATH is set
          const hasPath = finalEnv.some(e => e.startsWith("PATH="));
          if (!hasPath) {
            finalEnv.push("PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin");
          }
        }
        
        // Build exec message with only necessary fields
        const execMsg: any = {
          type: "exec",
          id: sessionId,
          cmd: finalCmd,
          stdin: false,
          pty: false,
        };
        
        // Only include optional fields if provided/non-empty
        if (finalArgv.length > 0) execMsg.argv = finalArgv;
        if (finalEnv.length > 0) execMsg.env = finalEnv;
        // Don't set cwd for remote VMs - use the remote's default working directory
        // (setting it can cause "command not found" if the path doesn't exist remotely)
        
        // Always send through connection if available
        if (self.connection) {
          self.connection.send(execMsg);
        } else {
          reject(new Error("Connection not available"));
        }
      } catch (err) {
        reject(err as Error);
      }
    })();

    // Create the ExecProcess object that is both a promise and has output() method
    const execProcess = Object.assign(
      // Make it a promise
      Promise.resolve(resultPromise).then(r => r),
      {
        // output() streams stdout chunks then completes when resultPromise resolves
        output: async function* () {
          // Yield any data chunks as they arrive
          for await (const chunk of stdout) {
            yield { data: chunk };
          }
          // Stream ended - resultPromise is already resolved at this point
        },
        // Make it awaitable like a promise
        then: (onFulfilled?: any, onRejected?: any) => resultPromise.then(onFulfilled, onRejected),
        catch: (onRejected?: any) => resultPromise.catch(onRejected),
        finally: (onFinally?: any) => resultPromise.finally(onFinally),
      }
    ) as ExecProcess;

    return execProcess;
  }

  /**
   * Close the connection
   */
  async close(): Promise<void> {
    if (this.connection) {
      this.connection.close();
      this.connection = null;
    }
    this.isConnected = false;
    this.sessions.clear();
  }

  /**
   * Get the session ID (used as VM id)
   */
  get id(): string {
    return this.sessionId;
  }

  /**
   * Handle JSON messages from remote session
   */
  private _handleMessage(msg: ServerMessage): void {
    if (msg.type === "exec_response") {
      const session = this.sessions.get(msg.id);
      if (session) {
        const stdoutBuffer = Buffer.concat(session.stdoutChunks);
        const stderrBuffer = Buffer.concat(session.stderrChunks);

        const result: ExecResult = {
          exitCode: msg.exit_code,
          signal: msg.signal,
          ok: msg.exit_code === 0,
          stdout: stdoutBuffer.toString("utf8"),
          stderr: stderrBuffer.toString("utf8"),
          stdoutBuffer,
          stderrBuffer,
        };



        // Defer stream closing to allow consumers to finish reading
        // This ensures for await loops can finish before streams end
        setImmediate(() => {
          session.stdout.end();
          session.stderr.end();
        });

        session.resolve(result);
        this.sessions.delete(msg.id);
      }
    } else if (msg.type === "error") {
      if (msg.id !== undefined) {
        const session = this.sessions.get(msg.id);
        if (session) {
          // Defer stream closing
          setImmediate(() => {
            session.stdout.end();
            session.stderr.end();
          });
          
          session.reject(new Error(`${msg.code}: ${msg.message}`));
          this.sessions.delete(msg.id);
        }
      }
    } else if (msg.type === "status") {
      // Handle status messages (e.g., "running", "stopped")
      // No action needed for status messages
    }
  }

  /**
   * Handle binary output frames (stdout/stderr)
   */
  private _handleBinaryOutput(frame: Buffer): void {
    if (frame.length < 5) return;

    const tag = frame[0];
    const id = frame.readUInt32BE(1);
    const data = frame.slice(5);

    const session = this.sessions.get(id);
    if (!session) {
      return;
    }

    if (tag === 1) {
      // stdout
      session.stdoutChunks.push(data);
      session.stdout.write(data);
    } else if (tag === 2) {
      // stderr
      session.stderrChunks.push(data);
      session.stderr.write(data);
    }
  }
}
