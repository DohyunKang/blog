Docker is a tool that bundles an application and the files it needs to run into an isolated process called a "container." It is used to reduce issues where something works on my PC but not on a server.

## First, in simple terms

When you deploy an app to a server, these problems often occur: My computer has Python 3.12, but the server has 3.8, or library versions differ, causing the app to fail. Docker documentation solves this by placing the app into a container, which is a "loosely isolated environment," so the app does not rely on what is installed on the host.

To use an analogy, it's like a moving container. By putting the luggage (the app) and its furniture (libraries, runtime) entirely into a box and moving it, the contents inside the box remain exactly the same regardless of which house you arrive at. However, this is just an analogy; in reality, the container does not mimic an additional computer. We will discuss that in the virtual machine section below.

[Details → Cloud Basics](#/post/cloud-basics)

## Images and Containers

The terms "image" and "container" appear together, which initially caused the most confusion.

| | Image | Container |
|---|---|---|
| Identity | Read-only template | The actual running instance of an image |
| Analogy | Recipe, installation file | The dish made from that recipe, or a running program |
| Changes | Does not change | Can change files while running |
| Count | One | Multiple from one image |

In Docker documentation terms, an image is a "read-only template containing instructions to create a container," and a container is a "runnable instance of an image." It becomes easy to understand if viewed as a class-object relationship: the image is the class, and the container is the instance.

Changes made inside a container disappear when the container is deleted unless they are saved separately to persistent storage (such as volumes). Therefore, when putting something like a database into a container, you must first decide where to store the data.

## Images are built from layers

An image is not a single block but a structure of multiple overlapping layers. The example in the document has five layers: base commands and package manager, Python runtime, requirements file, installed libraries, and finally my source code.

- Once created, a layer does not change (immutable).
- Changes made while a container runs are stacked in a separate directory specific to that container, leaving the original image layers intact. This allows multiple containers to be spun up from a single image.
- Layers are shared between images. Two apps using the same Python base layer only need to receive that layer once. The documentation states this reduces build speed, storage space, and transfer volume.

Each received layer is unpacked into its own directory on the host, and a union filesystem overlays them as one. The container's root directory points to this overlaid result.

## Dockerfile: Blueprint for Creating an Image

A text file that describes how to create an image is called a Dockerfile. I tried creating and running one directly.

```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY app.py .
CMD ["python", "app.py"]
```

`app.py` is a single-line file.

```python
import platform
print("hello from container:", platform.system())
```

Each line is read as follows:

- `FROM`: Specifies which image to start from. Here, the official Python image (slim) is used as the base.
- `WORKDIR`: The working directory where subsequent commands will run.
- `COPY`: Copies files from my PC into the image.
- `CMD`: The command to execute by default when the container starts.

The commands to build and run are as follows:

```bash
docker build -t blog-hello .
docker run --rm blog-hello
```

This is the result of running it on my PC (Windows).

```
hello from container: Linux
```

Although I ran this on a Windows PC, the inside of the container came out as Linux. This visually confirms that a container possesses its own filesystem and environment. The reason will be explained below. (On this PC, I used Docker Desktop to run it.)

Running `docker image history blog-hello` shows my added lines at the top:

```
CMD ["python" "app.py"]
COPY app.py . # buildkit
WORKDIR /app
CMD ["python3"]
RUN /bin/sh -c set -eux; ...   (베이스 이미지의 층들)
ENV PYTHON_VERSION=3.12.16
```

Below my three Dockerfile lines (`WORKDIR`, `COPY`, `CMD`) follow the layers stacked by the official Python image. If only my code layer changes, there is no need to re-download the base layers below. The documentation also states that rebuilding an image creates only the new changed layers.

## What's the difference from Virtual Machines?

Both are described as "isolated environments," making them seem similar. The difference lies in the kernel.

| | Virtual Machine (VM) | Container |
|---|---|---|
| Contents | Entire operating system (including kernel and drivers) + app | Files required by the app |
| Kernel | Separate for each VM | Shares the host kernel |
| Weight | Heavy | Lightweight (close to a process) |
| On same server | Fewer | More |

Docker documentation states that using a VM to isolate a single app has "high overhead," whereas containers can run more apps on the same infrastructure by sharing the host kernel. On the same page, it mentions that both are sometimes used together. In cloud environments, this often involves mounting a container runtime on top of a VM to run multiple containers.

So the reason for "Windows but running Linux" lies here. Containers use the host kernel; therefore, Linux containers require a Linux kernel. It is well-known that when using Docker Desktop on Windows or macOS, a Linux environment (virtualized) runs inside, and containers run on top of it.

Isolation is achieved through Linux kernel features. According to the documentation, Docker creates isolated workspaces for each container using features like namespaces; each aspect of a container runs in its own namespace, with access restricted strictly within that scope.

## Docker Architecture

The following table summarizes who does what when commands are executed, based on the official documentation.

| Component | Function |
|---|---|
| Client (`docker`) | The command-line tool we use. It sends commands to the daemon. |
| Daemon (`dockerd`) | Manages images, containers, networks, and volumes in the background. |
| Registry | Where images are stored. The default public registry is Docker Hub. |

When you run `docker run`, the client requests the daemon; if the image is not present locally, it pulls it from the registry. The client and daemon communicate via REST API (over UNIX sockets or a network).

## Common Misconceptions

- **Containers are small virtual machines:** No. They do not have their own kernel and instead use the host kernel. They are more akin to isolated processes.
- **Images and containers are the same thing:** An image is a template, while a container is an instance running that template. You can run multiple containers from a single image.
- **Files saved inside a container persist:** If not stored in a persistent volume (like a volume), files disappear when the container is deleted.
- **Security is automatic with Docker:** While isolation works, security depends on configuration and the source of the images.

<details>
<summary>Detailed explanation: Building layers by hand</summary>

The Docker documentation's layer tutorial builds layers manually without using a `Dockerfile`. Installing Node.js in an Ubuntu container and saving it via `docker container commit` creates a `node-base` layer. Adding `app.js` and committing again creates the `app` layer. Running `docker image history` shows the notes used during each commit (e.g., "Add node", "Add app").

The documentation states that a Dockerfile automates this process. The explanation that each line in a Dockerfile generates one layer was not explicitly stated in the document page I read this time. However, I directly confirmed that `WORKDIR`, `COPY`, and `CMD` from my Dockerfile appeared as separate lines via `docker image history` (I understand that configuration lines like `CMD` or `WORKDIR` result in layers with a size of 0, though I did not verify the size).

</details>

<details>
<summary>Detailed explanation: What I tested directly in this article</summary>

The environment was Docker 29.8.2 on Windows. I created `app.py` and `Dockerfile` in a temporary folder, executed `docker build` and `docker run --rm`, and the output matched the results in the main text. The base image `python:3.12-slim` was freshly pulled, and Python version 3.12.16 appeared in the image history. I deleted the image created after execution.

</details>

## Conclusion

By creating an image of what is running on my computer, you can simply pull that image and start it on a server. Next, I am curious about how to run this without a server or how automated deployment flows work.

[More details → Serverless](#/post/cloud-serverless) · [More details → CI/CD and Deployment Strategies](#/post/cloud-cicd) · [More details → Environment Variables and Secrets Management](#/post/cloud-secrets)

← [Cloud & Deployment Map](#/post/cloud-map)

Related posts: [Cloud Basics](#/post/cloud-basics) · [Serverless](#/post/cloud-serverless) · [CI/CD and Deployment Strategies](#/post/cloud-cicd)

## Source Links

- Docker Documentation, Docker overview: https://docs.docker.com/get-started/docker-overview/
- Docker Documentation, Understanding image layers: https://docs.docker.com/get-started/docker-concepts/building-images/understanding-image-layers/
- Docker Documentation, What is a container?: https://docs.docker.com/get-started/docker-concepts/the-basics/what-is-a-container/