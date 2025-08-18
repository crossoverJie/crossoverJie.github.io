---
title: 一个小时学会用 Go 编写命令行工具
date: 2020/12/08 08:10:36 
categories: 
- Golang
tags: 
- cli
- Golang
---

![](https://i.loli.net/2020/12/08/DMPGzwab7TyWeo9.jpg)

# 前言

最近因为项目需要写了一段时间的 `Go` ，相对于 `Java` 来说语法简单同时又有着一些 `Python` 之类的语法糖，让人大呼”真香“。

![](https://i.loli.net/2020/12/08/tEPj46risD7ahUH.jpg)

<!--more-->

但现阶段相对来说还是 `Python` 写的多一些，偶尔还得回炉写点 `Java` ；自然对 `Go` 也谈不上多熟悉。

于是便利用周末时间自己做个小项目来加深一些使用经验。于是我便想到了之前利用 `Java` 写的一个博客[小工具](https://github.com/crossoverJie/blog.toolbox)。

那段时间正值微博图床大量图片禁止外链，导致许多个人博客中的图片都不能查看。这个工具可以将文章中的图片备份到本地，还能将图片直接替换到其他图床。

![](https://i.loli.net/2019/05/08/5cd1cc7612c25.gif)

我个人现在是一直在使用，通常是在码字的时候利用 `iPic` 之类的工具将图片上传到微博图床（主要是方便+免费）。写完之后再通过这个工具一键切换到 `[SM.MS](http://sm.MS)` 这类付费图床，同时也会将图片备份到本地磁盘。

改为用 `Go` 重写为 `cli` 工具后使用效果如下：

![3-min.gif](https://i.loli.net/2020/12/08/enU3RDfikIKq9ao.gif)

# 需要掌握哪些技能

之所以选择这个工具用 `Go` 来重写；一个是功能比较简单，但也正好可以利用到 `Go` 的一些特点，比如网络 IO、协程同步之类。

同时修改为命令行工具后是不是感觉更极客了呢。

再开始之前还是先为不熟悉 `Go` 的 `Javaer` 介绍下大概会用到哪些知识点：

- 使用和管理第三方依赖包(`go mod`)
- 协程的运用。
- 多平台打包。

下面开始具体操作，我觉得即便是没怎么接触过 `Go` 的朋友看完之后也能快速上手实现一个小工具。

## 使用和管理第三方依赖

- 还没有安装 Go 的朋友请参考官网自行安装。

首先介绍一下 Go 的依赖管理，在版本 `1.11` 之后官方就自带了依赖管理模块，所以在当下最新版 `1.15` 中已经强烈推荐使用。

它的目的和作用与 `Java` 中的 `maven`，`Python` 中的 `pip` 类似，但使用起来比 `maven` 简单许多。

![](https://i.loli.net/2020/12/08/kxClhNWr13UZHzT.jpg)

根据它的使用参考，需要首先在项目目录下执行 `go mod init` 用于初始化一个 `go.mod` 文件，当然如果你使用的是 `GoLang` 这样的 `IDE`，在新建项目时会自动帮我们创建好目录结构，当然也包含 `go.mod` 这个文件。

在这个文件中我们引入我们需要的第三方包：

```go
module btb

go 1.15

require (
	github.com/cheggaaa/pb/v3 v3.0.5
	github.com/fatih/color v1.10.0
	github.com/urfave/cli/v2 v2.3.0
)
```

我这里使用了三个包，分别是：

- `pb`: progress bar，用于在控制台输出进度条。
- `color`: 用于在控制台输出不同颜色的文本。
- `cli`: 命令行工具开发包。

---

```go
import (
	"btb/constants"
	"btb/service"
	"github.com/urfave/cli/v2"
	"log"
	"os"
)

func main() {
	var model string
	downloadPath := constants.DownloadPath
	markdownPath := constants.MarkdownPath

	app := &cli.App{
		Flags: []cli.Flag{
			&cli.StringFlag{
				Name:        "model",
				Usage:       "operating mode; r:replace, b:backup",
				DefaultText: "b",
				Aliases:     []string{"m"},
				Required:    true,
				Destination: &model,
			},
			&cli.StringFlag{
				Name:        "download-path",
				Usage:       "The path where the image is stored",
				Aliases:     []string{"dp"},
				Destination: &downloadPath,
				Required:    true,
				Value:       constants.DownloadPath,
			},
			&cli.StringFlag{
				Name:        "markdown-path",
				Usage:       "The path where the markdown file is stored",
				Aliases:     []string{"mp"},
				Destination: &markdownPath,
				Required:    true,
				Value:       constants.MarkdownPath,
			},
		},
		Action: func(c *cli.Context) error {
			service.DownLoadPic(markdownPath, downloadPath)

			return nil
		},
		Name:  "btb",
		Usage: "Help you backup and replace your blog's images",
	}

	err := app.Run(os.Args)
	if err != nil {
		log.Fatal(err)
	}
}
```

代码非常简单，无非就是使用了 `cli` 所提供的 api 创建了几个命令，将用户输入的 `-dp`、`-mp` 参数映射到 `downloadPath`、`markdownPath` 变量中。

之后便利用这两个数据扫描所有的图片，以及将图片下载到对应的目录中。

更多使用指南可以直接参考[官方文档](https://github.com/urfave/cli/blob/master/docs/v2/manual.md)。

可以看到部分语法与 `Java` 完全不同，比如：

- 申明变量时类型是放在后边，先定义变量名称；方法参数类似。
- 类型推导，可以不指定变量类型（新版本的 `Java` 也支持）
- 方法支持同时返回多个值，这点非常好用。
- 公共、私用函数利用首字母大小写来区分。
- 还有其他的就不一一列举了。

---

## 协程

紧接着命令执行处调用了 `service.DownLoadPic(markdownPath, downloadPath)` 处理业务逻辑。

这里包含的文件扫描、图片下载之类的代码就不分析了；官方 `SDK` 写的很清楚，也比较简单。

重点看看 `Go` 里的 `goroutine` 也就是协程。

我这里使用的场景是每扫描到一个文件就利用一个协程去解析和下载图片，从而可以提高整体的运行效率。

```go
func DownLoadPic(markdownPath, downloadPath string) {
	wg := sync.WaitGroup{}
	allFile, err := util.GetAllFile(markdownPath)
	wg.Add(len(*allFile))

	if err != nil {
		log.Fatal("read file error")
	}

	for _, filePath := range *allFile {

		go func(filePath string) {
			allLine, err := util.ReadFileLine(filePath)
			if err != nil {
				log.Fatal(err)
			}
			availableImgs := util.MatchAvailableImg(allLine)
			bar := pb.ProgressBarTemplate(constants.PbTmpl).Start(len(*availableImgs))
			bar.Set("fileName", filePath).
				SetWidth(120)

			for _, url := range *availableImgs {
				if err != nil {
					log.Fatal(err)
				}
				err := util.DownloadFile(url, *genFullFileName(downloadPath, filePath, &url))
				if err != nil {
					log.Fatal(err)
				}
				bar.Increment()

			}
			bar.Finish()
			wg.Done()

		}(filePath)
	}
	wg.Wait()
	color.Green("Successful handling of [%v] files.\n", len(*allFile))

	if err != nil {
		log.Fatal(err)
	}
}
```

就代码使用层面看起来是不是要比 `Java` 简洁许多，我们不用像 `Java` 那样需要维护一个 `executorService`，也不需要考虑这个线程池的大小，一切都交给 `Go` 自己去调度。

使用时只需要在调用函数之前加上 `go` 关键字，只不过这里是一个匿名函数。

而且由于 `goroutine` 非常轻量，与 `Java` 中的 `thread` 相比占用非常少的内存，所以我们也不需要精准的控制创建数量。

---

不过这里也用到了一个和 `Java` 非常类似的东西：`WaitGroup`。

它的用法与作用都与 `Java` 中的 `CountDownLatch` 非常相似；主要用于等待所有的 `goroutine` 执行完毕，在这里自然是等待所有的图片都下载完毕然后退出程序。

使用起来主要分为三步：

- 创建和初始化 `goruntime` 的数量：`wg.Add(len(number)`
- 每当一个 `goruntime` 执行完毕调用 `wg.Done()` 让计数减一。
- 最终调用 `wg.Wait()` 等待`WaitGroup` 的数量减为0。

对于协程 Go 推荐使用 `chanel` 来互相通信，这点今后有机会再讨论。 

## 打包

核心逻辑也就这么多，下面来讲讲打包与运行；这点和 `Java` 的区别就比较大了。

众所周知，`Java` 有一句名言：`write once run anywhere`

这是因为有了 `JVM` 虚拟机，所以我们不管代码最终运行于哪个平台都只需要打出一个包；但 `Go` 没有虚拟机它是怎么做到在个各平台运行呢。

简单来说 `Go` 可以针对不同平台打包出不同的二进制文件，这个文件包含了所有运行所需要的依赖，甚至都不需要在目标平台安装 `Go` 环境。

- 虽说 Java 最终只需要打一个包，但也得在各个平台安装兼容的 `Java` 运行环境。

我在这里编写了一个 `Makefile` 用于执行打包：`make release`

```makefile
# Binary name
BINARY=btb
GOBUILD=go build -ldflags "-s -w" -o ${BINARY}
GOCLEAN=go clean
RMTARGZ=rm -rf *.gz
VERSION=0.0.1

release:
	# Clean
	$(GOCLEAN)
	$(RMTARGZ)
	# Build for mac
	CGO_ENABLED=0 GOOS=darwin GOARCH=amd64 $(GOBUILD)
	tar czvf ${BINARY}-mac64-${VERSION}.tar.gz ./${BINARY}
	# Build for arm
	$(GOCLEAN)
	CGO_ENABLED=0 GOOS=linux GOARCH=arm64 $(GOBUILD)
	tar czvf ${BINARY}-arm64-${VERSION}.tar.gz ./${BINARY}
	# Build for linux
	$(GOCLEAN)
	CGO_ENABLED=0 GOOS=linux GOARCH=amd64 $(GOBUILD)
	tar czvf ${BINARY}-linux64-${VERSION}.tar.gz ./${BINARY}
	# Build for win
	$(GOCLEAN)
	CGO_ENABLED=0 GOOS=windows GOARCH=amd64 $(GOBUILD).exe
	tar czvf ${BINARY}-win64-${VERSION}.tar.gz ./${BINARY}.exe
	$(GOCLEAN)
```

可以看到我们只需要在 `go build` 之前指定系统变量即可打出不同平台的包，比如我们为 `Linux` 系统的 `arm64` 架构打包文件：

`CGO_ENABLED=0 GOOS=linux GOARCH=arm64 go build main.go -o btb`

便可以直接在目标平台执行 `./btb`  运行程序。

# 总结

本文所有代码都已上传 `Github`: [https://github.com/crossoverJie/btb](https://github.com/crossoverJie/btb)

感兴趣的也可以直接运行安装脚本体验。

```bash
curl -fsSL https://raw.githubusercontent.com/crossoverJie/btb/master/install.sh | bash
```

- 目前这个版本只实现了图片下载备份，后续会完善图床替换及其他功能。

---

这段时间接触 `Go` 之后给我的感触颇深，对于年纪 25 岁的 `Java` 来说，`Go` 确实是后生可畏，更气人的是还赶上了云原生这个浪潮，就更惹不起了。

一些以前看来不那么重要的小毛病也被重点放大，比如启动慢、占用内存多、语法啰嗦等；不过我依然对这位赏饭吃的祖师爷保持期待，从新版本的 `Java` 可以看出也在积极改变，更不用说它还有无人撼动的庞大生态。

更多 `Java` 后续内容可以参考周志明老师的文章：[云原生时代，Java危矣？](https://mp.weixin.qq.com/s/fVz2A-AmgfhF0sTkz8ADNw)
