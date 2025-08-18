---
title: 用 Antlr 重构脚本解释器
date: 2022/08/08 08:08:08 
categories: 
- gscript
- compiler
tags: 
- go
- antlr
---
![](https://tva1.sinaimg.cn/large/e6c9d24ely1h4y7c4s1gbj20z20kd0we.jpg)

# 前言

在上一个版本实现的脚本解释器 [GScript](https://github.com/crossoverJie/gscript) 中实现了基本的四则运算以及 `AST` 的生成。

![](https://tva1.sinaimg.cn/large/e6c9d24ely1h4ybcb7x07j20im0hcgne.jpg)

当我准备再新增一个 `%` 取模的运算符时，会发现工作很繁琐而且几乎都是重复的；主要是两步：
1. 需要在词法解析器中新增对 `%` 符号的支持。
2. 在语法解析器遍历 AST 时对 `%` token 实现具体逻辑。

其中的词法解析和遍历 AST 完全是重复工作，所以我们可否能够简化这两步呢？

<!--more-->

# Antlr

`Antlr` 就是做帮我们解决这些问题的常用工具，利用它我们只需要编写词法文件，然后就可以自动生成词法、语法解析器，并且可以生成不同语言的代码。

下面以 `GScript` 的示例来看看 antlr 是如何帮我们生成词法分析器的。

```go
func TestGScriptVisitor_Visit_Lexer(t *testing.T) {
	expression := "(2+3) * 2"
	input := antlr.NewInputStream(expression)
	lexer := parser.NewGScriptLexer(input)
	for {
		t := lexer.NextToken()
		if t.GetTokenType() == antlr.TokenEOF {
			break
		}
		fmt.Printf("%s (%q) %d\n",
			lexer.SymbolicNames[t.GetTokenType()], t.GetText(),t.GetColumn())
	}
}
```

```shell
//output:
 ("(") 0
DECIMAL_LITERAL ("2") 1
PLUS ("+") 2
DECIMAL_LITERAL ("3") 3
 (")") 4
MULT ("*") 6
DECIMAL_LITERAL ("2") 8
```

`Antlr ` 会自动将我们的表达式解析为 `token`，遍历 `token` 时还能拿到该 `token` 所在的代码行数、位置等信息，在编译期间做语法检查非常有用。

要实现这些我们只需要编写词法、语法规则文件即可。

刚才的示例所对应的词法、语法规则如下：

```antlr
expr
    : '(' expr ')'                        #NestedExpr
    | liter=literal #Liter
    | lhs=expr bop=( MULT | DIV ) rhs=expr #MultDivExpr
    | lhs=expr bop=MOD rhs=expr            #ModExpr
    | lhs=expr bop=( PLUS | SUB ) rhs=expr #PlusSubExpr
    | expr bop=(LE | GE | GT | LT ) expr # GLe
    | expr bop=(EQUAL | NOTEQUAL) expr # EqualOrNot
    ;
DECIMAL_LITERAL:    ('0' | [1-9] (Digits? | '_'+ Digits)) [lL]?;    
```

> 完整规则：[https://github.com/crossoverJie/gscript/blob/main/GScript.g4](https://github.com/crossoverJie/gscript/blob/main/GScript.g4)

运行：

```shell
antlr -Dlanguage=Go -o parser -visitor -no-listener GScript.g4
```

就可以帮我们生成 `Go` 的代码（默认是 `Java`），关于 `Antlr` 的词法、文法规则以及安装步骤请参考[官网](https://www.antlr.org/)。

而我们要实现具体的语法逻辑时只需要实现相关的接口，`Antlr` 会自动遍历 `AST`（当然也可以手动控制），同时在访问不同的 `AST` 节点时会回调我们自己实现的接口，这样我们就能编写自己的语法规则了。

以这里的新增的取模运算为例：

```go
func (v *GScriptVisitor) VisitModExpr(ctx *parser.ModExprContext) interface{} {
	lhs := v.Visit(ctx.GetLhs())
	rhs := v.Visit(ctx.GetRhs())
	return lhs.(int) % rhs.(int)
}
```

当 `Antlr` 回调 `VisitModExpr` 方法时，便能获取到 % 符号左右两侧的数据，这时只需要做相关运算即可。


基于这个模式这次新增了一个 `statement`，具体语法如下：

```go
func TestGScriptVisitor_VisitIfElse8(t *testing.T) {
	expression := `
if(3!=(1+2)){
	return 1+3
} else {
	return false
}`
	input := antlr.NewInputStream(expression)
	lexer := parser.NewGScriptLexer(input)
	stream := antlr.NewCommonTokenStream(lexer, 0)
	parser := parser.NewGScriptParser(stream)
	parser.BuildParseTrees = true
	tree := parser.Prog()
	visitor := GScriptVisitor{}
	var result = visitor.Visit(tree)
	fmt.Println(expression, " result:", result)
	assert.Equal(t, result, false)
}
```

Antlr 还有其他各种优势，比如可以解决：
- 左递归。
- 二义性。
- 优先级。

等问题。

这里也推荐在 IDE 中安装 Antlr 的插件，这样就可以直观的查看  AST 语法树，可以帮我们更好的调试代码。

![](https://tva1.sinaimg.cn/large/e6c9d24ely1h4ydh1xkenj22gk0qm43a.jpg)
![](https://tva1.sinaimg.cn/large/e6c9d24ely1h4ydhe0vnpj217s0r277g.jpg)


# 升级 xjson

借助 `GScript` 提供的 `statement`，`xjson` 也提供了有些有意思的写法：
![](https://tva1.sinaimg.cn/large/e6c9d24ely1h4yekrs5r5j219w0fu0v9.jpg)

因为 `xjson` 的四则运算语法没有使用 `Antlr` 生成，所以为了能支持 `GScript` 提供的 `statement` 需要手写许多词法代码。

![](https://tva1.sinaimg.cn/large/e6c9d24ely1h4ye5optx1j21ji0u0wir.jpg)

这也体现了 `Antlr` 这类前端工具的重要性，效率提升是非常明显的。

# 总结

借助于 `Antlr` 后续 `GScript` 会继续支持函数调用、更完善的类型系统、面向对象等特性；感兴趣的朋友请持续关注。

源码地址：
[https://github.com/crossoverJie/gscript](https://github.com/crossoverJie/gscript)
[https://github.com/crossoverJie/xjson](https://github.com/crossoverJie/xjson)