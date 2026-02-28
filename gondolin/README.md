# Custom image for gondolin sandbox

## Build image builder container

All of this can be done directly on the host, but gondolin cli do not play right on OSX.
We use a container here to build gondolin custom images assets.

```sh
docker build -t pi-coding-agent-image-builder --target image-builder . --load
```

## build example pi image

```sh
docker run --privileged -it -v $(pwd)/vm-build:/vm-build --workdir /vm-build pi-coding-agent-image-builder gondolin build --config pi-build-config.json --output ./pi-assets
```

# Run gondolin with custom image

On the host
```sh
export GONDOLIN_GUEST_DIR=$(pwd)/vm-build/pi-assets
```