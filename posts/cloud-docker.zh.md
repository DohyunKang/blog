Docker 是一种工具，它将应用程序及其运行所需的文件打包在一起，以便在名为“容器”的隔离进程中执行。我们使用它来减少那些在本地 PC 上能运行但在服务器上无法运行的问题。

## 首先用通俗的话来说

将应用程序部署到服务器后，经常会出现以下情况：我的电脑使用的是 Python 3.12，而服务器是 3.8 或其他版本；或者库的版本不同导致程序无法运行。Docker 文档是这样解决这个问题的：将应用程序放入“松散隔离的环境”即容器中，使应用程序不再依赖主机上安装了什么。

打个比方，就像搬家集装箱一样。把货物（应用）和里面的家具（库、运行时）整个装进箱子里搬走，所以无论到达的是什么样的房子，箱子内部都保持不变。但这只是个比喻，实际上容器并不是真的在模拟另一台电脑。这一点会在下面的“虚拟机”部分说明。

[详情 → 云基础](#/post/cloud-basics)

## 镜像与容器

这两个术语一开始最容易让人混淆。

| | 镜像 (image) | 容器 (container) |
|---|---|---|
| 本质 | 只读模板 | 实际运行的镜像实例 |
| 比喻 | 食谱、安装包 | 用该食谱制作的菜肴、正在运行的程序 |
| 是否变化 | 不变化 | 运行时文件可能会发生变化 |
| 数量 | 一个 | 一个镜像可生成多个容器 |

按照 Docker 文档的表述，镜像是“包含构建容器指令的只读模板”，而容器是“镜像的可运行实例”。如果将其视为类与对象的关系，就更容易理解了：镜像是类，容器是实例。

在容器内部所做的更改，如果不单独保存到持久化存储（如卷等），会在删除容器时一并消失。因此，当将数据库等内容放入容器时，必须首先确定数据存放的位置。

## 镜像由层 (layer) 堆叠而成

镜像并非单一整体，而是由多层叠加而成的结构。文档中的示例包含五层：基础命令和包管理器、Python 运行时、需求文件、已安装的库，最后是源代码。

- 一旦创建的层是不可变的（immutable）。
- 容器运行过程中产生的更改会累积在容器专用的目录中，而原始镜像层保持不变。因此，一个镜像可以启动多个容器。
- 层可以在镜像之间共享。使用相同 Python 基础层的两个应用只需接收一次该层即可。文档指出，这有助于提高构建速度、节省存储空间并减少传输量。

接收到的每一层都会在主机上解压到各自的目录中，并通过联合文件系统（union filesystem）将它们叠加显示为一个整体。容器的根目录指向这个叠加后的结果。

## Dockerfile：构建镜像的设计图

Dockerfile 是一个文本文件，其中记录了创建镜像的方法。我自己动手制作并运行了它。

```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY app.py .
CMD ["python", "app.py"]
```

`app.py` 只有一行代码。

```python
import platform
print("hello from container:", platform.system())
```

每一行的含义如下：

- `FROM`：指定基于哪个镜像开始构建。这里使用了官方的 Python 镜像（slim 版本）作为基础。
- `WORKDIR`：后续命令将在此工作目录中执行。
- `COPY`：将本地 PC 上的文件复制到镜像内部。
- `CMD`：启动容器时默认执行的命令。

构建和运行的命令如下：

```bash
docker build -t blog-hello .
docker run --rm blog-hello
```

这是在 Windows PC 上运行的结果。

```
hello from container: Linux
```

虽然在 Windows PC 上运行，但容器内部却是 Linux 环境。这直观地展示了容器拥有自己独立的文件系统和环境。原因将在下文说明。（本机上使用的是 Docker Desktop。）

通过 `docker image history blog-hello` 查看层结构，可以看到我添加的指令显示在顶部：

```
CMD ["python" "app.py"]
COPY app.py . # buildkit
WORKDIR /app
CMD ["python3"]
RUN /bin/sh -c set -eux; ...   (베이스 이미지의 층들)
ENV PYTHON_VERSION=3.12.16
```

在我 Dockerfile 中的三行指令（`WORKDIR`、`COPY`、`CMD`）下方，紧接着是 Python 官方镜像堆叠的各层。只要我的代码层发生变化，就不需要重新接收下方的基础层。文档也指出，重新构建镜像时只会生成发生变化的层。

## 容器与虚拟机有何不同

两者都被称为“隔离环境”，因此容易被视为相同。区别在于内核。

| | 虚拟机 (VM) | 容器 |
|---|---|---|
| 包含内容 | 整个操作系统（含内核、驱动）+ 应用 | 应用所需的文件 |
| 内核 | 每个 VM 拥有独立内核 | 共享主机内核 |
| 资源占用 | 较重 | 较轻（更接近进程） |
| 同一服务器上的数量 | 较少 | 更多 |

Docker 文档指出，如果仅为了隔离单个应用而使用虚拟机，“开销较大”；而容器通过共享主机内核，可以在相同基础设施上运行更多应用。在同一页面还提到，两者也可以结合使用。在云环境中，通常是在虚拟机之上部署容器运行时，从而运行多个容器。

因此，上述“在 Windows 上却运行 Linux”的原因也在于此。容器使用宿主机的内核，而 Linux 容器则需要 Linux 内核。在 Windows 或 Mac 上使用 Docker Desktop 时，内部会运行一个 Linux 环境（虚拟化），容器则在该环境中运行。

隔离是通过 Linux 内核功能实现的。根据文档，Docker 利用类似 namespace 的功能为每个容器创建隔离的工作空间，容器的各个方面都在各自的 namespace 中运行，且访问被限制在内部。

## Docker 的架构

这里整理了实际执行命令时各组件的作用（基于官方文档）。

| 组件 | 功能 |
|---|---|
| 客户端 (`docker`) | 我们使用的命令行工具，向守护进程发送命令 |
| 守护进程 (`dockerd`) | 在后台实际管理镜像、容器、网络和卷 |
| 仓库 | 存储镜像的地方。默认的公开仓库是 Docker Hub |

执行 `docker run` 时，客户端会向守护进程发出请求；如果本地没有镜像，则从仓库拉取。客户端与守护进程通过 REST API 进行通信（通过 UNIX 套接字或网络）。

## 常见误区

- **容器是小型虚拟机**：不对。容器没有自己的内核，而是使用宿主机内核。它更接近于隔离进程。
- **镜像和容器是同一个概念**：错误。镜像是模板，容器是正在运行的实例。一个镜像可以运行多个容器。
- **容器中保存的文件会保留**：如果不存放在卷等持久化存储中，删除容器时文件也会消失。
- **使用 Docker 就自动安全**：虽然具备隔离性，但安全性取决于配置和镜像来源。

<details>
<summary>详细解析：手动构建层级</summary>

Docker 文档中的分层教程是无需 `Dockerfile` 而手动构建层级的。在 Ubuntu 容器中安装 Node.js 并使用 `docker container commit` 保存后，会生成名为 `node-base` 的层；再向其中放入 `app.js` 并再次 commit，则会生成 `app` 层。执行 `docker image history` 可以看到每一层在 commit 时使用的备注（如 "Add node"、"Add app"）。

文档指出 `Dockerfile` 可自动化此过程。关于“每行命令生成一层”的说明，在本次阅读的文档页面中并未明确提及。不过，此前通过 `docker image history` 观察到 Dockerfile 中的 `WORKDIR`、`COPY`、`CMD` 等指令确实各自对应一层（据我所知，像 `CMD`、`WORKDIR` 这类配置性指令会生成大小为 0 的层，但我并未查看其大小）。

</details>

<details>
<summary>详细解析：本文亲自测试的内容</summary>

环境为 Docker 29.8.2（Windows）。在临时文件夹中创建了 `app.py` 和 `Dockerfile`，并执行了 `docker build` 和 `docker run --rm`，输出结果与正文一致。基础镜像拉取了最新的 `python:3.12-slim`，从镜像历史中可见 Python 版本为 3.12.16。运行完成后已删除生成的镜像。

</details>

## 总结

将本地运行的环境打包成镜像后，在服务器上只需接收并启动该镜像即可。接下来我想了解如何在无服务器环境下运行此类应用，以及自动部署的流程。

[更多 → 无服务器](#/post/cloud-serverless) · [更多 → CI/CD 与部署策略](#/post/cloud-cicd) · [更多 → 环境变量与密钥管理](#/post/cloud-secrets)

← [云与部署概览图](#/post/cloud-map)

相关文章：[云基础](#/post/cloud-basics) · [无服务器](#/post/cloud-serverless) · [CI/CD 与部署策略](#/post/cloud-cicd)

## 参考链接

- Docker 文档，Docker 概述：https://docs.docker.com/get-started/docker-overview/
- Docker 文档，理解镜像层级：https://docs.docker.com/get-started/docker-concepts/building-images/understanding-image-layers/
- Docker 文档，什么是容器：https://docs.docker.com/get-started/docker-concepts/the-basics/what-is-a-container/