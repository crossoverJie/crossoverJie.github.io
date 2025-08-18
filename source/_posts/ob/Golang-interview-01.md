---
title: Golang 基础面试题 01
date: 2023/09/12 20:58:03
categories: 
- Golang
tags: 
-  面试
---
![Golang 面试题合集.png](https://s2.loli.net/2023/09/12/xJgnyReWs2mp7Pr.png)

#  背景

在之前的文章中分享了 [k8s](https://crossoverjie.top/2023/08/17/ob/k8s-question-01/) 相关的面试题，本文我们重点来讨论和 k8s 密切相关的 Go 语言面试题。

这几年随着云原生的兴起，大部分后端开发者，特别是 Java 开发者都或多或少的想学习一些 Go 相关的技能，所以今天分享的内容比较初级，适合 Go 语言初学者。

![image.png](https://s2.loli.net/2023/09/12/oheqNwJt3KvsgDM.png)


本文内容依然来自于这个仓库
[https://github.com/bregman-arie/devops-exercises](https://github.com/bregman-arie/devops-exercises)
<!--more-->


以下是具体内容：
> （）的内容是我的补充部分。

# Go 101
## Go 语言有哪些特点
- Go 是一种强类型静态语言，变量的类型必须在声明的时候指定（但可以使用类型推导），在运行时不能修改变量类型（与 `Python` 这类动态类型语言不同）。
- 足够的简单，通常一个周末就能学会
- 编译速度够快
- 内置并发（相对于 Java 的并发来说非常简单）
- 内置垃圾收集
- 多平台支持
- 可以打包到一个二进制文件中，所有运行时需要依赖的库都会被打包进这个二进制文件中，非常适合于分发。

## Go 是一种编译型的静态类型语言，正确还是错误
正确✅

## 为什么有些函数是以大写字母开头的
这是因为 Go 语言中首字母大写的函数和变量是可以导出的，也就是可以被其他包所引用；类似于 Java 中的 `public` 和 `private` 关键字。

# 变量和数据类型

## 简洁和常规声明变量方式

```go
package main

import "fmt"

func main() {
  x := 2 // 只能在函数内使用，自动类型推导
  var y int = 2

  fmt.Printf("x: %v. y: %v", x, y)
}
```


## 正确✅还是错误❌
- 可以重复声明变量❌（强类型语言的特性）
- 变量一旦声明，就必须使用✅（避免声明无效变量，增强代码可读性）


## 下面这段代码的结果是什么？

```go
package main

import "fmt"

func main() {
    var userName
    userName = "user"
    fmt.Println(userName)
}
```

编译错误，变量 `userName` 没有声明类型；修改为这样是可以的：
```go
func main() {
    var userName string
    userName = "user"
    fmt.Println(userName)
}
```

## `var x int = 2` and `x := 2` 这两种声明变量的区别
结果上来说是相等的，但 `x := 2`  只能在函数体类声明。

## 下面这段代码的结果是声明？
```go
package main

import "fmt"

x := 2

func main() {
    x = 3
    fmt.Println(x)
}
```

编译错误，`x := 2`  不能在函数体外使用， `x = 3` 没有指定类型，除非使用 `x := 3` 进行类型推导。

## 如何使用变量声明块（至少三个变量）

```go
package main

import "fmt"

var (
  x bool   = false
  y int    = 0
  z string = "false"
)

func main() {
  fmt.Printf("The type of x: %T. The value of x: %v\n", x, x)
  fmt.Printf("The type of y: %T. The value of y: %v\n", y, y)
  fmt.Printf("The type of z: %T. The value of z: %v\n", y, y)
}
```
变量块配合 `go fmt` 格式化之后的代码对齐的非常工整，强迫症的福音。

Go 的基础面试题也蛮多的，我们先从基础的开始，今后后继续更新相关面试题，难度也会逐渐提高，感兴趣的朋友请持续关注。
#GO #面试 
