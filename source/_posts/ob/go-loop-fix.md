---
title: Go 语言史诗级更新-循环Bug修复
date: 2023/09/24 18:05:25
categories:
  - Golang
tags:
  - loop
---
![](https://s2.loli.net/2023/09/24/rU7IujkPWX1TRQM.png)
# 背景

前两天 `Golang` 的官方博客更新了一篇文章：[Fixing For Loops in Go 1.22](https://go.dev/blog/loopvar-preview)

看这个标题的就是修复了 Go 循环的 bug，这真的是史诗级的更新；我身边接触到的大部分 Go 开发者都犯过这样的错误，包括我自己，所以前两年我也写过类似的博客：
[简单的 for 循环也会踩的坑](https://crossoverjie.top/2021/12/28/go/for-mistake/)

<!--more-->

先来简单回顾下使用使用 for 循环会碰到的问题：
```go
list := []*Demo{{"a"}, {"b"}}  
for _, v := range list {  
	go func() {  
		fmt.Println("name="+v.Name)  
	}()  
}  
  
type Demo struct {  
	Name string  
}
```

预期的结果应该是打印 `a,b`，但实际打印的却是`b,b`。

![image.png](https://s2.loli.net/2023/09/24/I98GMk5efvNUDbT.png)

[Let's Encrypt: CAA Rechecking bug](https://bugzilla.mozilla.org/show_bug.cgi?id=1619047)
类似的问题连 `mozilla` 团队也没能幸免，所以也确实是一个非常常见的问题，这样的写法符合大部分的开发者的直觉，毕竟其他语言这么使用也没有问题。

当然在现阶段要解决也很简单，要么就是在使用之前先复制一次，或者使用闭包传参：
```go
 // 复制
 list := []*Demo{{"a"}, {"b"}}  
 for _, v := range list {  
  temp:=v  
  go func() {  
   fmt.Println("name="+temp.Name)  
  }()  
 }

 // 闭包
 list := []*Demo{{"a"}, {"b"}}  
 for _, v := range list {  
  go func(temp *Demo) {  
   fmt.Println("name="+temp.Name)  
  }(v)  
 }
```


还好官方也意识到了这个问题：
![image.png](https://s2.loli.net/2023/09/24/6NTZSijCofypK54.png)
所以在 1.22 中我们可以不用再写这个 `    v:=v`这个多余的复制语句了，也不会出现上面的问题。

我们在 1.21 中可以使用环境变量预览这个特性:
```go
❯ GOEXPERIMENT=loopvar go test
name=b
name=a
```
在 1.22 发布后建议大家都可以升级了，将这种恶心的 bug 扼杀在摇篮里。

1.22 后带来了一个好消息是今后少了一道面试题，坏消息是又新增了一个 1.22 版本带来了哪些变化的面试题😂

更多详情可以参看官方播客：[https://go.dev/blog/loopvar-preview](https://go.dev/blog/loopvar-preview)