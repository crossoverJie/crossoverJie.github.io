---
title: Go 去找个对象吧
date: 2021/02/24 08:15:26 
categories: 
- 基础原理
tags: 
- Go
- Java
- OOP
- 鸭子类型
---

![](https://i.loli.net/2021/02/23/hFc3XiSMYAZoRr7.jpg)

## 前言

我的读者中应该大部分都是 `Java` 从业者，不知道写 `Java` 这些年是否真的有找到对象？

没找到也没关系，总不能在一棵树上吊死，我们也可以来 `Go` 这边看看，说不定会有新发现。

开个玩笑，本文会以一个 `Javaer` 的角度来聊聊 `Go` 语言中的面向对象。

<!--more-->

## OOP

面向对象这一词来源于`Object Oriented Programming`，也就是大家常说的 `OOP`。

对于 `Go` 是否为面向对象的编程语言，这点也是讨论已久；不过我们可以先看看官方的说法:

![](https://i.loli.net/2021/02/23/ZMnvzj1tAVXlBsu.jpg)

其他的我们暂且不看，`Yes and No.` 这个回答就比较微妙了，为了这篇文章还能写下去我们先认为 `Go` 是面向对象的。

---

面向对象有着三个重要特征：

1. 封装
2. 继承
3. 多态

## 封装

`Go` 并没有 `Class` 的概念，却可以使用 `struct` 来达到类似的效果，比如我们可以对汽车声明如下：

```go
type Car struct {
	Name string
	Price float32
}
```

与 `Java` 不同的是，`struct` 中只存储数据，不能定义行为，也就是方法。

当然也能为 `Car` 定义方法，只是写法略有不同：

```go
func (car *Car) Info()  {
	fmt.Printf("%v price: [%v]", car.Name, car.Price)
}

func main() {
	car := Car{
		Name: "BMW",
		Price: 100.0,
	}
	car.Info()

}
```

在方法名称前加上 `(car *Car)` 便能将该方法指定给 `Car` ，其中的 `car` 参数可以理解为 `Java` 中的 `this` 以及 `Python` 中的 `self`，就语义来说我觉得 `go` 更加简单一些。

毕竟我见过不少刚学习 `Java` 的萌新非常不理解 `this` 的含义与用法。

### 匿名结构体

既然谈到结构体了那就不得不聊聊 `Go` 支持的匿名结构体（虽然和面向对象没有太大关系）

```go
func upload(path string) {
	body, err := ioutil.ReadAll(res.Body)
	smsRes := struct {
		Success bool   `json:"success"`
		Code    string `json:"code"`
		Message string `json:"message"`
		Data    struct {
			URL string `json:"url"`
		} `json:"data"`
		RequestID string `json:"RequestId"`
	}{}
	err = json.Unmarshal(body, &smsRes)
	fmt.Printf(smsRes.Message)
}
```

`Go` 允许我们在方法内部创建一个匿名的结构体，后续还能直接使用该结构体来获取数据。

这点在我们调用外部接口解析响应数据时非常有用，创建一个临时的结构体也不用额为维护；同时还能用面向对象的方式获取数据。

相比于将数据存放在 `map` 中用字段名获取要优雅许多。

## 继承

`Go` 语言中并没有 `Java`、`C++` 这样的继承概念，类之间的关系更加扁平简洁。

各位 `Javaer` 应该都看过这类图：

![](https://i.loli.net/2021/02/23/D28awlxb6HZIqS3.jpg)

相信大部分新手看到这图时就已经懵逼，更别说研究各个类之间的关系了。

不过这样好处也明显：如果我们抽象合理，整个系统结构会很好维护和扩展；但前提是我们能抽象合理。

在 `Go` 语言中更推荐使用组合的方式来复用数据：

```go
type ElectricCar struct {
	Car
	Battery int32
}

func main() {
	xp := ElectricCar{
		Car{Name: "xp", Price: 200},
		70,
	}
	fmt.Println(xp.Name)

}
```

这样我们便可以将公共部分的数据组合到新的 `struct` 中，并能够直接使用。

## 接口(多态)

面向接口编程的好处这里就不在赘述了，我们来看看 Go 是如何实现的：

```go
type ElectricCar struct {
	Car
	Battery int32
}
type PetrolCar struct {
	Car
	Gasoline int32
}

//定义一个接口
type RunService interface {
	Run()
}

// 实现1
func (car *PetrolCar) Run() {
	fmt.Printf("%s PetrolCar run \n", car.Name)
}

// 实现2
func (car *ElectricCar)Run() {
	fmt.Printf("%s ElectricCar run \n", car.Name)
}

func Do(run RunService) {
	run.Run()
}

func main() {
	xp := ElectricCar{
		Car{Name: "xp", Price: 200},
		70,
	}
	petrolCar := PetrolCar{
		Car{Name: "BMW", Price: 300},
		50,
	}
	Do(&xp)
	Do(&petrolCar)

}
```

首先定义了一个接口 `RunService`；`ElectricCar` 与 `PetrolCar` 都实现了该接口。

可以看到 `Go` 实现一个接口的方式并不是 `implement`，而是用结构体声明一个相同签名的方法。

这种实现模式被称为”鸭子类型“，`Python` 中的接口也是类似的`鸭子类型`。

![](https://i.loli.net/2021/02/23/yScLUx7lVJWCojM.jpg)

详细介绍可以参考这篇：[Python 中的面向接口编程](https://crossoverjie.top/2021/01/14/basic/python-oop/)

接口当然也是可以扩展的，类似于 `struct` 中的嵌套：

```go
type DiService interface {
	Di()
}

//定义一个接口
type RunService interface {
	DiService
	Run()
}
```

![](https://i.loli.net/2021/02/23/tFmpBuxHcfSvZW2.jpg)

得益于 `Go` 的强类型，刚才的 `struct` 也得实现 `DiService` 这个接口才能编译通过。

# 总结

到这里应该是能理解官方所说的 `Yes and No.` 的含义了；`Go` 对面向对象的语法不像 `Java` 那么严苛，甚至整个语言中都找不到 `object(对象)` 这个关键词；但是利用 `Go` 里的其他特性也是能实现 `OOP` 的。

是否为面向对象我觉得并不重要，主要目的是我们能写出易扩展好维护的代码。

例如官方标准库中就有许多利用接口编程的例子：

![](https://i.loli.net/2021/02/23/yUEi7zVkCxjW863.jpg)

由于公司技术栈现在主要由 `Go` 为主，后续也会继续更新 `Go` 相关的实战经验；如果你也对学习 `Go` 感兴趣那不妨点个关注吧。
