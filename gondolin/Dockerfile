# docker build -t pi-coding-agent-image-builder --target image-builder . --load
# docker run --privileged -it -v $(pwd)/vm-build:/vm-build --workdir /vm-build pi-coding-agent-image-builder
# gondolin build --config build-config.json --output ./pi-coding-agent
# GONDOLIN_GUEST_DIR=/vm-build/pi-coding-agent gondolin bash
FROM alpine:latest AS image-builder

# neeeded for building the image, but not for running it, so we install them in the builder stage
RUN apk update && apk --no-cache add git curl nodejs npm cmake build-base zig e2fsprogs lz4

# needed to build system image assets
RUN git clone --depth 1 https://github.com/earendil-works/gondolin.git /tmp/gondolin
RUN npm install -g @earendil-works/gondolin
ENV GONDOLIN_GUEST_SRC=/tmp/gondolin/guest/
