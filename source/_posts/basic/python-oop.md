---
title: Python 中的面向接口编程
date: 2021/01/14 08:13:26
banner_img: https://i.loli.net/2021/01/14/pPAYXUDmc2Vxr1d.jpg
index_img: https://i.loli.net/2021/01/14/pPAYXUDmc2Vxr1d.jpg
categories: 
- 基础原理
tags: 
- Python
- OOP
- 鸭子类型
---

![](https://i.loli.net/2021/01/14/pPAYXUDmc2Vxr1d.jpg)

# 前言

`”面向接口编程“`写 `Java` 的朋友耳朵已经可以听出干茧了吧，当然这个思想在 `Java` 中非常重要，甚至几乎所有的编程语言都需要，毕竟程序具有良好的扩展性、维护性谁都不能拒绝。

<!--more-->

最近无意间看到了我刚开始写 `Python` 时的部分代码，当时实现的需求有个很明显的特点：

- 不同对象具有公共的行为能力，但具体每个对象的实现方式又各不相同。

说人话就是商户需要接入平台，接入的步骤相同，但具体实现不同。

 

作为一个”资深“ `Javaer`，需求还没看完我就洋洋洒洒的把各个实现类写好了：

![](https://i.loli.net/2021/01/14/OanLP4i9VMIBw16.jpg)

当然最终也顺利实现需求，甚至把组里一个没写过 `Java` 的大哥唬的一愣一愣的，直呼牛逼。

![](https://i.loli.net/2021/01/14/VnFHiBELTesvXAW.jpg)

不过事后也给我吐槽：

- 你这设计是不错，但是感觉好复杂，跟代码时要找到真正的业务逻辑（实现类）得绕几圈。

截止目前 `Python` 写多了，我总算是能总结他的感受：就是不够 `Pythonic`。

虽说 `Python` 没有类似 `Java` 这样的 `Interface` 特性，但作为面向对象的高级语言也是支持继承的；

在这里我们也可以利用继承的特性来实现面向接口编程：

```python
class Car:
    def run(self):
        pass

class Benz(Car):
    def run(self):
        print("benz run")

class BMW(Car):

    def run(self):
        print("bwm run")

def run(car):
    car.run()

if __name__ == "__main__":
    benz = Benz()
    bmw = BMW()

    run(benz)
    run(bmw)
```

代码非常简单，在 `Python` 中也没有类似于 `Java` 中的 `extends` 关键字，只需要在类声明末尾用括号包含基类即可。

这样在每个子类中就能单独实现业务逻辑，方便扩展和维护。

# 类型检查

由于 `Python` 作为一个动态类型语言，无法做到 `Java` 那样在编译期间校验一个类是否完全实现了某个接口的所有方法。

为此 `Python` 提供了解决办法，那就是 `abc(Abstract Base Classes)` ，当我们将基类用 `abc` 声明时就能近似做到：

```python
import abc
class Car(abc.ABC):
    @abc.abstractmethod
    def run(self):
        pass

class Benz(Car):
    def run(self):
        print("benz run")

class BMW(Car):
    pass

def run(car):
    car.run()

if __name__ == "__main__":
    benz = Benz()
    bmw = BMW()

    run(benz)
    run(bmw)
```

一旦有类没有实现方法时，运行期间便会抛出异常：

```python
bmw = BMW()
TypeError: Can't instantiate abstract class BMW with abstract methods run
```

虽然无法做到在运行之前（毕竟不需要编译）进行校验，但有总比没有好。

# 鸭子类型

以上两种方式看似已经毕竟优雅的实现面向接口编程了，但实际上也不够 `Pythonic`。

在继续之前我们先聊聊`接口`的本质到底是什么？

在 `Java` 这类静态语言中面向接口编程是比较麻烦的，也就是我们常说的子类向父类转型，因此需要编写额外的代码。

带来的好处也是显而易见，只需要父类便可运行。

但我们也不必过于执着于接口，它本身只是一个协议、规范，并不特指 `Java` 中的 `Interface`，甚至有些语言压根没有这个关键字。

动态语言的特性也不需要强制校验是否实现了方法。

在 `Python` 中我们可以利用鸭子类型来优雅的实现面向接口编程。

在这之前先了解下鸭子类型，借用维基百科的说法：

- “当看到一只鸟走起来像鸭子、游泳起来像鸭子、叫起来也像鸭子，那么这只鸟就可以被称为鸭子。”

我用大白话翻译下就是：

即便两个完全不想干的类，如果他们都实现了相同的方法，那就可以把他们当做同一类型的类来使用。

举个简单例子：

```python
class Order:
    def create(self):
        pass

class User:
    def create(self):
        pass

def create(obj):
    obj.create()

if __name__ == "__main__":
    order = Order()
    user = User()
    create(order)
    create(user)
```

这里的 `order` 和 `user` 本身完全没有关系，只是他们都有相同方法，又得益于动态语言没法校验类型的特点，所以完全可以在运行的时候认为他们是同一种类型。

因此基于鸭子类型，之前的代码我们可以稍作简化：

```python
class Car:
    def run(self):
        pass

class Benz:
    def run(self):
        print("benz run")

class BMW:
    def run(self):
        print("bwm run")

def run(car):
    car.run()

if __name__ == "__main__":
    benz = Benz()
    bmw = BMW()

    run(benz)
    run(bmw)
```

因为在鸭子类型中我们在意的是它的行为，而不是他们的类型；所以完全可以不用继承便可以实现面向接口编程。

# 总结

我觉得平时没有接触过动态类型语言的朋友，在了解完这些之后会发现新大陆，就像是 `Python` 老手第一次使用 `Java` 时；虽然觉得语法啰嗦，但也会羡慕它的类型检查、参数验证这类特点。

动静语言之争这里不做讨论了，各有各的好，鞋好不好穿只有自己知道。

随便提一下其实不止动态语言具备鸭子类型，有些静态语言也能玩这个骚操作，感兴趣下次再介绍。
