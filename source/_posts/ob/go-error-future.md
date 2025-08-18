---
title: 关于 Golang 的错误处理的讨论可以大结局了
date: 2025/06/05 17:08:57
banner_img: https://s2.loli.net/2025/08/15/B8x4m7ShYuZnMei.png
index_img: https://s2.loli.net/2025/08/15/B8x4m7ShYuZnMei.png
categories:
  - OB
tags:
---
  

  原文链接：[[ On | No ] syntactic support for error handling](https://go.dev/blog/error-syntax)

-----------------------------------

关于 Go 语言最有争论的就是错误处理：

```Go
x, err := call()
if err != nil {
        // handle err
}
```


`if err != nil` 类似于这样的代码非常多，淹没了其余真正有用的代码。这通常发生在进行大量API调用的代码中，其中错误处理很普遍，只是简单地返回错误，有些最终的代码看起来像这样：

  
```Go
func printSum(a, b string) error {
    x, err := strconv.Atoi(a)
    if err != nil {
        return err
    }
    y, err := strconv.Atoi(b)
    if err != nil {
        return err
    }
    fmt.Println("result:", x + y)
    return nil
}
```

<!--more-->

在这个函数的十行代码中，只有四行看起来是有实际的作用。其余六行看起来甚至会影响主要的逻辑。所以关于错误处理的抱怨多年来一直位居我们年度用户调查的榜首也就不足为奇了。（有一段时间，缺乏泛型支持超过了对错误处理的抱怨，但现在 Go 已经支持泛型了，错误处理又回到了榜首。）


Go团队认真对待社区反馈，因此多年来我们一直在尝试为这个问题找到解决方案，并听取 Go 社区的意见。


Go 团队的第一次明确尝试可以追溯到 2018 年，当时Russ Cox[正式提到了这个问题](https://go.googlesource.com/proposal/+/master/design/go2draft-error-handling-overview.md)，作为我们当时称为 Go2 努力的一部分。他基于 Marcel van Lohuizen 的[草案设计](https://go.googlesource.com/proposal/+/master/design/go2draft-error-handling.md)概述了一个可能的解决方案。该设计基于`check`和`handle`机制，相当全面。草案包括对替代解决方案的详细分析，包括与其他语言采用的方法的比较。如果您想知道您的特定错误处理想法之前是否被考虑过，请阅读这份文档！

```Go
// printSum implementation using the proposed check/handle mechanism.
func printSum(a, b string) error {
    handle err { return err }
    x := check strconv.Atoi(a)
    y := check strconv.Atoi(b)
    fmt.Println("result:", x + y)
    return nil
}
```
  

`check`和`handle`方法被认为过于复杂，大约一年后，在2019年，我们推出了更加简化的、现在[臭名昭著](https://go.dev/issue/32437#issuecomment-2278932700)的[`try`提案](https://go.googlesource.com/proposal/+/master/design/32437-try-builtin.md)。它基于 `check` 和 `handle` 的思想，但 `check` 伪关键字变成了`try`内置函数，`handle`部分被省略了。为了探索`try`内置函数的影响，我们编写了一个简单的工具（[tryhard](https://github.com/griesemer/tryhard)），使用`try`重写现有的错误处理代码。这个提案被激烈争论，在[GitHub问题](https://go.dev/issue/32437)上接近900条评论。

  
```Go
// printSum implementation using the proposed try mechanism.
func printSum(a, b string) error {
    // use a defer statement to augment errors before returning
    x := try(strconv.Atoi(a))
    y := try(strconv.Atoi(b))
    fmt.Println("result:", x + y)
    return nil
}
```

然而，`try`通过在出错时从封闭函数返回来影响控制流，并且可能从深度嵌套的表达式中这样做，从而隐藏了这种控制流。这使得该提案对许多人来说难以接受，尽管在这个提案上投入了大量精力，我们还是决定放弃这项工作。回顾起来，引入一个新关键字可能会更好，这是我们现在可以做的事情，因为我们通过`go.mod`文件和特定文件的指令对语言版本有细粒度的控制。将`try`的使用限制在赋值和语句中可能会缓解一些其他的担忧。Jimmy Frasche的[最近提案](https://go.dev/issue/73376)基本上回到了原始的`check`和`handle`设计，并解决了该设计的一些缺点，正朝着这个方向发展。

  

`try`提案的反响导致了大量的反思，包括Russ Cox的一系列博客文章：["关于Go提案流程的思考"](https://research.swtch.com/proposals-intro)。其中一个结论是，我们可能通过提出一个几乎完全成熟的提案，给社区反馈留下很少的空间，以及一个"具有威胁性"的实现时间表，从而降低了获得更好结果的机会。根据["Go提案流程：大型变更"](https://research.swtch.com/proposals-large)："回顾起来，`try`是一个足够大的变更，我们发布的新设计应该是第二版草案设计，而不是带有实现时间表的提案"。但不管在这种情况下可能存在的流程和沟通失败，用户对该提案有着非常强烈地抵触情绪。


当时我们没有更好的解决方案，几年来都没有为错误处理追求语法变更。不过，社区中的许多人受到了启发，我们收到了源源不断的错误处理提案，其中许多非常相似，有些有趣，有些难以理解，有些不可行。为了跟踪不断扩大的提案，一年后，Ian Lance Taylor 创建了一个[总体问题](https://go.dev/issue/40432)，总结了改进错误处理的提议变更的当前状态。创建了一个[Go Wiki](https://go.dev/wiki/Go2ErrorHandlingFeedback)来收集相关的反馈、讨论和文章。


关于错误处理冗长性的抱怨持续存在（参见[2024年上半年Go开发者调查结果](https://go.dev/blog/survey2024-h1-results)），因此，在Go团队内部提案经过一系列日益完善之后，Ian Lance Taylor 在2024年发布了["使用`?`减少错误处理样板代码"](https://go.dev/issue/71203)。这次的想法是借鉴[Rust](https://www.rust-lang.org/)中实现的构造，特别是[`?`操作符](https://doc.rust-lang.org/std/result/index.html#the-question-mark-operator-)。希望通过依靠使用既定符号的现有机制，并考虑我们多年来学到的东西，我们应该能够最终取得一些进展。在一小批用户调研中，向开发者展示使用 `?` 的 Go 代码时，绝大多数参与者正确猜出了代码的含义，这进一步说服我们再试一次。为了能够看到变化的影响，Ian 编写了一个工具，将普通 Go 代码转换为使用提议的新语法的代码，我们还在编译器中对该功能进行了原型设计。

```Go
// printSum implementation using the proposed "?" statements.
func printSum(a, b string) error {
    x := strconv.Atoi(a) ?
    y := strconv.Atoi(b) ?
    fmt.Println("result:", x + y)
    return nil
}
```
  

不幸的是，与其他错误处理想法一样，这个新提案也很快被评论淹没，许多人建议进行微调，通常基于个人偏好。Ian关闭了提案，并将内容移到了[讨论区](https://go.dev/issue/71460)，以促进对话并收集进一步的反馈。一个稍作修改的版本得到了[稍微积极一些](https://github.com/golang/go/discussions/71460#discussioncomment-12060294)的接受，但广泛的支持仍然难以达成一致。


经过这么多年的尝试，Go团队提出了三个完整的提案，社区提出了数百个提案，其中大多数是各类提案的变体，所有这些都未能获得足够（更不用说压倒性）的支持，我们现在面临的问题是：如何继续？我们是否应该继续？

_我们认为不应该。_

更准确地说，我们应该停止尝试解决_语法问题_，至少在可预见的未来是这样。[提案流程](https://github.com/golang/proposal?tab=readme-ov-file#consensus-and-disagreement)为这个决定提供了理由：

> 提案流程的目标是及时就结果达成普遍共识。如果提案审查无法在问题跟踪器上的问题讨论中确定普遍共识，通常的结果是提案被拒绝。
  
  

没有一个错误处理提案达到任何接近共识的程度，所以它们都被拒绝了。即使是 Google 的 Go 团队最资深的成员也不一致同意目前最佳的方案（也许在某个时候会改变）。但是没有具体的共识，我们就无法合理地向前推进。

  
有支持现状的有效证据： 

* 如果 Go 早期就为错误处理引入了特定的语法糖，今天几乎没有人会争论它。但我们已经走过了15年，机会已经过去了，Go 有一种完全合适的错误处理方式，即使有时看起来可能很冗长。
  

* 从另一个角度看，假设我们今天找到了完美的解决方案。将其纳入语言只会导致从一个不满意的用户群体（支持变更的）转移到另一个（喜欢现状的）。当我们决定向语言添加泛型时，我们处于类似的情况，尽管有一个重要的区别是：今天没有人被迫使用泛型，好的泛型库的编写使得用户可以基本忽略它们是不是泛型，这要归功于类型推断。相反，如果向语言添加新的错误处理语法构造，几乎每个人都需要开始使用它，以免他们的代码变得不符合最新的范式。

  

* 不添加额外的语法符合 Go 的设计规则之一：不提供多种做同一件事的方式。在" foot traffic "的领域有这个规则的例外：赋值就是一个例子。具有讽刺意味的是，在[短变量声明](https://go.dev/ref/spec#Short_variable_declarations)（`:=`）中重新声明变量的能力是为了解决因错误处理而产生的问题而引入的：没有重新声明，错误检查序列需要为每个检查使用不同名称的`err`变量（或额外的单独变量声明）。当时更好的解决方案可能是为错误处理提供更多的语法支持。那样的话，可能就不需要重新声明规则了，没有它各种相关的[复杂性](https://go.dev/issue/377)也就不存在了。

* 回到实际的错误处理代码，如果错误得到处理，冗长性就会被淡化。良好的错误处理通常需要向错误添加额外信息。例如，用户调查中的一个反复出现的评论是关于缺少与错误相关的堆栈信息。这可以通过生成并返回增强错误的支持函数来解决。在这个例子中，模板代码的相对数量要小得多：

```Go
func printSum(a, b string) error {
    x, err := strconv.Atoi(a)
    if err != nil {
        return fmt.Errorf("invalid integer: %q", a)
    }
    y, err := strconv.Atoi(b)
    if err != nil {
        return fmt.Errorf("invalid integer: %q", b)
    }
    fmt.Println("result:", x + y)
    return nil
}
```
  

* 新的标准库功能也可以帮助减少错误处理样板代码，这与Rob Pike 2015年的博客文章["错误就是值"](https://go.dev/blog/errors-are-values)的观点非常相似。例如在某些情况下，[`cmp.Or`](https://go.dev/pkg/cmp#Or)可用于一次处理一系列错误：

  

```Go
func printSum(a, b string) error {
    x, err1 := strconv.Atoi(a)
    y, err2 := strconv.Atoi(b)
    if err := cmp.Or(err1, err2); err != nil {
        return err
    }
    fmt.Println("result:", x+y)
    return nil
}
```



* 编写、阅读和调试代码都是完全不同的工作。编写重复的错误检查可能很乏味，但今天的 IDE 提供了强大的、甚至是 LLM 辅助的代码补全。编写基本的错误检查对这些工具来说很简单。在阅读代码时冗长性最明显，但工具在这里也可能有所帮助；例如，有 Go 语言设置的 IDE 可以提供一个切换开关来隐藏错误处理代码。


* 在调试错误处理代码时，能够快速添加`println`或有一个专门的行位置来在调试器中设置断点会很有帮助。当已经有专门的`if`语句时，这很容易。但如果所有错误处理逻辑都隐藏在`check`、`try`或`?`后面，代码可能必须首先更改为普通的`if`语句，这会使调试复杂化，甚至可能引入一些错误。



* 还有实际的考虑：想出一个新的错误处理语法想法很容易；因此社区提出了大量的提案。想出一个经得起审查的好解决方案：就不那么容易了。正确设计语言变更并实际实现它需要协调一致的努力。真正的成本仍然在后面：所有需要更改的代码、需要更新的文档、需要调整的工具。综合考虑，语法变更非常昂贵，Go 团队相对较小，还有很多其他优先事项要处理。


* 最后一点，我们中的一些人最近有机会参加[Google Cloud Next 2025](https://cloud.withgoogle.com/next/25)，Go团队在那里有一个展位，我们还举办了一个小型的Go聚会。我们有机会询问的每一位Go用户都坚决认为我们不应该为了更好的错误处理而改变语言。许多人提到，当刚从另一种具有错误处理支持的语言转过来时，Go中缺乏特定的错误处理支持最为明显。随着人们使用的时间越来越久，这个问题变得不那么重要了。这当然不是一个足够大的代表性人群，但它是我们在 GitHub上 看到的不同人群。

  
当然，也有支持变更的理由：

* 缺乏更好的错误处理支持仍然是我们用户调查中最大的抱怨。如果Go团队真的认真对待用户反馈，我们最终应该为此做些什么。（尽管似乎也没有[压倒性的支持](https://github.com/golang/go/discussions/71460#discussioncomment-11977299)语言变更。）


* 也许单一地关注减少字符数不是一个正确的方向。更好的方法可能是使用关键字使默认错误处理高度可见，同时也要删除模板代码（`err != nil`）。这种方法可能使读者（代码审查者）更容易看到错误被处理了，而不需要"看多次"，从而提高代码质量和安全性。这将使我们回到`check`和`handle`的起点。

* 我们真的不知道现在的冗长问题在多大程度上是错误检查直接导致的。

  

尽管如此，迄今为止没有任何解决错误处理的尝试获得足够的支持。如果我们诚实地评估我们所处的位置，我们只能承认我们既没有对问题的共同理解，也不是都同意首先存在问题。考虑到这一点，我们做出以下符合当下的决定：

  
_在可预见的未来，Go团队将停止为错误处理追求语法语言变更。我们还将关闭所有主要涉及错误处理语法的开放和即将提交的提案，不再进一步跟进。

  

社区在探索、讨论和辩论这些问题上投入了巨大的努力。虽然这可能没有导致错误处理语法的任何变化，但这些努力已经为 Go 语言和我们的流程带来了许多其他改进。也许，在未来的某个时候，关于错误处理会出现更清晰的图景。在那之前，我们期待着将这种令人难以置信的热情集中在新的机会上，让Go对每个人都变得更好。

  
# 总结一下


1. **问题背景**：Go的错误处理一直被认为过于冗长，多年来一直是用户调查中的首先被抱怨的。
    
2. **历次尝试**：
    - 2018年的 `check` 和 `handle` 机制
    - 2019年的 `try` 提案
    - 2024年的 `?` 操作符提案
3. **最终决定**：经过多年尝试和数百个提案，Go团队决定在可预见的未来停止追求错误处理的语法变更，主要原因包括：
    - 没有达成共识
    - 现有方式虽然冗长但足够好
    - 改变会造成社区分裂
    - 工具和库可以帮助缓解问题
4. **未来方向**：团队将关注其他改进Go语言的机会，而不是继续在错误处理语法上投入精力。
    
由于  Go 长期没有错误处理的解决方案，导致这个问题被拖了很久，从而每个开发者也都有自己的使用习惯，越多人参与讨论就越难以达成一致。

