---
title: 如何在本地打包 StarRocks 发行版
date: 2025/05/12 17:47:52
banner_img: https://s2.loli.net/2025/08/15/YTsEFPUSt7yVH3k.png
index_img: https://s2.loli.net/2025/08/15/YTsEFPUSt7yVH3k.png
categories:
  - StarRocks
tags:
  - StarRocks
---
最近我们在使用 StarRocks 的时候碰到了一些小问题：
- 重启物化视图的时候会导致视图全量刷新，大量消耗资源。
		- 修复 PR：[https://github.com/StarRocks/starrocks/pull/57371](https://github.com/StarRocks/starrocks/pull/57371)
- excluded_refresh_tables 参数与 MV 不在一个数据库的时候，无法生效。
	- 修复 PR：[https://github.com/StarRocks/starrocks/pull/58752](https://github.com/StarRocks/starrocks/pull/58752)

而提交的 PR 是有发布流程的，通常需要间隔一段时间才会发布版本，但是我们线上又等着用这些修复，没办法就只有在本地打包了。

好在社区已经考虑到这种场景了，专门为我们提供了打包的镜像。


<!--more-->

> FE 是 Java 开发的，本地构建还比较容易，而 BE 是基于 cpp 开发的，构建环境比较复杂，在统一的 docker 镜像里构建会省去不少环境搭建流程。

我们先要拉取对应的打包镜像：
```shell
starrocks/dev-env-ubuntu:3.3.9
```

根据自己的版本号拉取即可，比如我这里使用的是 3.3.9 的版本。

然后需要根据我使用的 tag 拉取一个我们自己的开发分支，在这个分支上将修复的代码手动合并进来。

然后便可以开始打包了。

```shell
git clone git@github.com:StarRocks/starrocks.git /xx/starrocks

docker run -it -v /xx/starrocks/.m2:/root/.m2 \ 
-v /xx/starrocks:/root/starrocks \ 
--name 3.3.9 -d starrocks/dev-env-ubuntu:3.3.9

docker exec -it 3.3.9 bash

cd /root/starrocks/

./build.sh --fe --clean
```

我们需要将宿主机的代码磁盘挂载到镜像里，这样镜像就会使用我们的源码进行编译构建。

最终会在 `/xx/starrocks/output` 目录生成我们的目标文件。

![](https://s2.loli.net/2025/05/14/RqDW2k9telrP4YN.png)

## 替换目标镜像

既然 fe 的各种 jar 包都已经构建出来了，那就可以基于这些 jar 包手动打出 fe 的 image 了。

我们可以参考官方例子，使用 `fe-ubuntu.Dockerfile` 来构建 FE 的镜像。

```shell
DOCKER_BUILDKIT=1 docker build --build-arg ARTIFACT_SOURCE=local --build-arg LOCAL_REPO_PATH=. -f fe-ubuntu.Dockerfile -t fe-ubuntu:main ../../..
```

除此之外还有更简单的方式，也是更加稳妥的方法。

我们可以直接使用官方的镜像作为基础镜像，只替换其中核心的 `starrocks-fe.jar` 。
> 这个 jar 包会在编译的时候构建出来

因为 `starrocks-fe.jar` 也是通过同样的镜像打包出来的，所以运行起来不会出现兼容性问题（同样的 jdk 版本），而且也能保证原有的镜像没有修改。

```dockerfile
FROM starrocks/fe-ubuntu:3.3.9
COPY starrocks-fe.jar /opt/starrocks/fe/lib/
```

```shell
docker build -t fe-ubuntu:3.3.9-fix-{branch} .
```

这样我们就可以放心的替换线上的镜像了。

参考链接：
- [https://docs.starrocks.io/zh/docs/developers/build-starrocks/Build_in_docker/](https://docs.starrocks.io/zh/docs/developers/build-starrocks/Build_in_docker/) 
- https://github.com/StarRocks/starrocks/blob/759a838ae15b91056233f180aedc88da67a84937/docker/dockerfiles/fe/README.md#L15