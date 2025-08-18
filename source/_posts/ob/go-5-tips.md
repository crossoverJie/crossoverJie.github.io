---
title: 【译】五个我最近在 Go 里学到的小技巧
date: 2024/07/02 18:42:39
categories:
  - 翻译
  - Go
tags:
- Go
---

原文链接：[https://medium.com/@andreiboar/5-small-tips-i-recently-learned-in-go-cf52d50cf129](https://medium.com/@andreiboar/5-small-tips-i-recently-learned-in-go-cf52d50cf129)

# 让编译器计算数组数量
我们在 Go 通常很少使用数组 arrays，一般使用切片 Slice 来代替；

但是当你需要使用的时候，如果你对需要指定数量大小感到很烦时可以使用 `[...]` 让编译器自动帮我们计算数组大小：

```go
package main  
  
import "fmt"  
  
func main() {  
arr := [3]int{1, 2, 3}  
sameArr := [...]int{1, 2, 3} // Use ... instead of 3  
  
// Arrays are equivalent  
fmt.Println(arr)  
fmt.Println(sameArr)  
}
```

<!--more-->

# 使用 go run . 替换 go run main.go

每当我用 Go 写第一行代码时，我都习惯于开始写 `main.go`:

```go
package main

import "fmt"

func main() {
    sayHello()
}

func sayHello() {
    fmt.Println("Hello!")
}  
```

但是当 `main.go` 变得越来越大时，我喜欢把一些结构体移动到新的文件里，还是在 main 这个包中。

main.go:

```go
package main  
  
func main() {  
	sayHello()  
}
```

say_hello.go:

```go
package main  
  
import "fmt"  
  
func sayHello() {  
	fmt.Println("Hello!")  
}
```

此时使用 `go run main.go` 将会得到以下的错误：

```shell
# command-line-arguments  
./main.go:4:2: undefined: sayHello
```

此时可以使用 `go run .` 来解决这个问题。

# 使用下划线让你的数字变得更易读
你知道可以使用下划线使得你的长数字更易读吗？

```go
package main

import "fmt"

func main() {
    number := 10000000
    better := 10_000_000

    fmt.Println(number == better)
} 
```

# 可以在同一个包下有不同的测试包

在 Go 中我通常认为一个目录下只能有一个包，但也不是完全正确的。

假设你有一个包名为：`yourpackage` 此时你可以还可以在同一个目录下创建一个名为 `yourpackage_test` 的包，同时在这个包里编写你的测试代码。

这样做的好处是，那些没有被 exporter 的函数在 `yourpackage_test` 包下是不能直接访问的，确保测试的是被暴露的函数。

# 多次传递相同参数的简单方法

在使用字符串格式化函数时，我总是觉得必须重复一个多次使用的参数很烦人：

```go
package main

import "fmt"

func main() {
    name := "Bob"
    fmt.Printf("My name is %s. Yes, you heard that right: %s\n", name, name)
} 
```
还好还有更简便的方法，这样只需要传递一次参数：

```go
package main  
  
import "fmt"  
  
func main() {  
	name := "Bob"  
	fmt.Printf("My name is %[1]s. Yes, you heard that right: %[1]s\n", name)  
}
```

在这个 Twitter 里发现的：
![](https://s2.loli.net/2024/07/02/vaMP9CXwTEFcGKI.png)

希望你今天学到了一些新东西，最近有没有发现一些你从来不知道的 Golang 小技巧？