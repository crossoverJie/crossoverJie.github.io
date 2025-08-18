---
title: 词法分析器的应用
date: 2020/03/23 08:29:36 
categories: 
- 编译原理
tags: 
- Java
- 递归
- DDL
---

![](https://i.loli.net/2020/03/23/4onkHVWNTsELqaK.jpg)

# 前言

最近大部分时间都在撸 `Python`，其中也会涉及到将数据库表转换为 `Python` 中 `ORM` 框架的 `Model`，但我们并没有找到一个合适的工具来做这个意义不大的”体力活“，所以每次新建表后大家都是根据自己的表结构手写一遍 `Model`。

一两张表还好，一旦 10 几张表都要写一遍时那痛苦只有自己知道；这时程序员的 slogan 再次印证：一切毫无意义的体力劳动终将被计算机取代。

<!--more-->

# intellij plugin

既然没有现成的工具那就自己写一个吧，演示效果如下：
![1-min.gif](https://i.loli.net/2020/03/23/dLpAoxf4BwEj81S.gif)

考虑到我们主要是用 `PyCharm` 开发，正好 `jetbrains` 也提供了 `SDK` 用于开发插件，所以 `UI` 层面可以不用额外考虑了。

使用流程很简单，只需要导入 `DDL` 语句就可以生成 `Python` 所需要的 `Model` 代码。

例如导入以下 DDL：

```sql
CREATE TABLE `user` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `userName` varchar(20) DEFAULT NULL COMMENT '用户名',
  `password` varchar(100) DEFAULT NULL COMMENT '密码',
  `roleId` int(11) DEFAULT NULL COMMENT '角色ID',
  PRIMARY KEY (`id`),  
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8
```

便会生成对应的 Python 代码：

```python
class User(db.Model):
    __tablename__ = 'user'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    userName = db.Column(db.String)  # 用户名
    password = db.Column(db.String)  # 密码
    roleId = db.Column(db.Integer)  # 角色ID
```


# 词法解析

仔细对比源文件及目标代码会很容易找出规律，无非就是解析出表名、字段、及字段的属性（是否为主键、类型、长度），最后再转换为 `Python` 所需要的模板即可。

在我动手之前我认为是非常简单的，无非就是解析字符串，但实际上手后发现不是那么回事；主要是有以下几个问题：

1. 如何识别出表名称？
2. 同样的如何识别出字段名称，同时还得关联上该字段的类型、长度、注释。
3. 如何识别出主键？


总结一句话，如何通过一系列规则识别出一段字符串中的关键信息，这同样也是 MySQL Server 所做的事情。

在开始真正解析 DDL 之前，先来看下一段简单的脚本如何解析：

```java
x = 20
```

按照我们平时开发的经验，这条语句分为以下几部分：

- `x` 表示变量
- `=` 表示赋值符号
- `20` 表示赋值结果

所以我们对这段脚本的解析结果应当为：

```
VAR 	 x
GE 	    =
VAL 	 100
```

这个解析过程在编译原理中称为”词法解析“，可能大家听到`编译原理`这几个字就头大（我也是）；对于刚才那段脚本我们可以编写一个非常简单的词法解析器生成这样的结果。

## 状态迁移

再开始之前先捋一下思路，可以看到上文的结果中通过 `VAR` 表示变量、`GE` 表示赋值符号 ”=“、`VAL` 表示赋值结果，现在需要重点记住这三个状态。

在依次读取字符解析时，程序就是在这几个状态中来回切换，如下图：
![](https://i.loli.net/2020/03/23/XPcKbDVUNsSeGM9.jpg)

1. 默认为初始状态。
2. 当字符为字母时进入 `VAR` 状态。
3. 当字符为 ”=“ 符号时进入 `GE` 状态。


![](https://i.loli.net/2020/03/23/3mRvj4O1y8EgPNu.jpg)

同理，当不满足这几个状态时候又会回到初始从而再次确认新的状态。

光看图有点抽象，直接来看核心代码：

```java
    public class Result{
        public TokenType tokenType ;
        public StringBuilder text = new StringBuilder();
    }
```

首先定义了一个结果类，收集最终的解析结果；其中的 `TokenType` 就对应了图中的三种状态，简单的用枚举值来表示。

```java
public enum TokenType {
    INIT,
    VAR,
    GE,
    VAL
}
```

首先对应到第一张图：初始化状态。

需要对当前解析的字符定义一个 `TokenType`：
![](https://i.loli.net/2020/03/23/3WU5vyiGF1eCq47.jpg)

和图中描述的流程一致，判断当前字符给定一个状态即可。

接着对应到第二张图：状态之间的转换。

![](https://i.loli.net/2020/03/23/BXqdW1JPMj59yTG.jpg)

会根据不同的状态进入不同的 `case`，在不同的 `case` 中判断是否应当跳转到其他状态（进入 `INIT` 状态后会重新生成状态）。

举个例子： `x = 20`:

首选会进入 `VAR` 状态，接着下一个字符为空格，自然在 38 行中重新进入初始状态，导致再次确定下一个字符 `=` 进入 `GE` 状态。

当脚本为 `ab = 30`:
第一个字符为 a 也是进入 `VAR` 状态，第二个字符为 b，依然为字母，所以进入 36 行，状态不会改变，同时将 b 这个字符追加进来；后续步骤就和上一个例子一致了。

多说无益，建议大家自己跑一下单测就会明白：
[https://github.com/crossoverJie/sqlalchemy-transfer/blob/master/src/test/java/top/crossoverjie/plugin/core/lab/TestLexerTest.java](https://github.com/crossoverJie/sqlalchemy-transfer/blob/master/src/test/java/top/crossoverjie/plugin/core/lab/TestLexerTest.java)
![](https://i.loli.net/2020/03/23/xvB3uJAPm8tsDSF.jpg)
![](https://i.loli.net/2020/03/23/EDNnAXGTJRbmkij.jpg)

## DDL 解析

简单的解析完成后来看看 `DDL` 这样的脚本应当如何解析：

```sql
CREATE TABLE `user` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `userName` varchar(20) DEFAULT NULL COMMENT '用户名',
  `password` varchar(100) DEFAULT NULL COMMENT '密码',
  `roleId` int(11) DEFAULT NULL COMMENT '角色ID',
  PRIMARY KEY (`id`),  
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8
```

原理类似，首先还是要看出规律（也就是语法）：

- 表名是第一行语句，同时以 `CREATE TABLE` 开头。
- 每一个字段的信息（名称、类型、长度、备注）都是以 "`" 符号开头 "," 结尾。 
- 主键是以 PRIMART 字符串开头的字段，以 `)` 结尾。

根据我们需要解析的数据种类，我这里定义了这个枚举：
![](https://i.loli.net/2020/03/23/p1UxCHKNGbDQZ5d.jpg)

然后在初始化类型时进行判断赋值：
![](https://i.loli.net/2020/03/23/mtsRX534r7hpqHy.jpg)

由于需要解析的数据不少，所以这里的判断条件自然也就多了。

## 递归解析

针对于 `DDL` 的语法规则，我们这里还有需要有特殊处理的地方；比如解析具体字段信息时如何关联起来？

举个例子：

```sql
`userName` varchar(20) DEFAULT NULL COMMENT '用户名',
`password` varchar(100) DEFAULT NULL COMMENT '密码',
```

这里我们解析出来的数据得有一个映射关系：

![](https://i.loli.net/2020/03/23/MHdbTgSY5IELwQc.jpg)

所以我们只能一个字段的全部信息解析完成并且关联好之后才能解析下一个字段。

于是这里我采用了递归的方式进行解析（不一定是最好的，欢迎大家提出更优的方案）。

```java
} else if (value == '`' && pStatus == Status.BASE_INIT) {
    result.tokenType = DDLTokenType.FI;
    result.text.append(value);
} 
```

当当前字符为 ”`“ 符号时，将状态置为 "FI"(FieldInfo)，同时当解析到为 "," 符号时便进入递归处理。

![](https://i.loli.net/2020/03/23/bDYsyUZB3cwLHu6.jpg)

可以理解为将这一段字符串单独提取出来处理：

```sql
`userName` varchar(20) DEFAULT NULL COMMENT '用户名',
```

接着再将这段字符递归调用当前方法再次进行解析，这时便按照字段名称、类型、长度、注释的规则解析即可。

同时既然存在递归，还需要将子递归的数据关联起来，所以我在返回结果中新增了一个 `pid` 的字段，这个也容易理解。

默认值为 0，一旦递归后便自增 +1，保证每次递归的数据都是唯一的。

用同样的方法在解析主键时也是先将整个字符串提取出来:

```sql
PRIMARY KEY (`id`)
```

只不过是 "P" 打头 ")" 结尾。

```java
} else if (value == 'P' && pStatus == Status.BASE_INIT) {
    result.tokenType = DDLTokenType.P_K;
    result.text.append(value);
} 
```

![](https://i.loli.net/2020/03/23/MYVlc4Sb9LovH2z.jpg)

也是将整段字符串递归解析，再递归的过程中进行状态切换 `P_K ---> P_K_V` 最终获取到主键。

----

![](https://i.loli.net/2020/03/23/qRkbKrH9IWtVnw1.jpg)

所以通过对刚才那段 `DDL` 解析得到的结果如下：

![](https://i.loli.net/2020/03/23/k3GCZe1sKujtbrp.jpg)

这样每个字段也通过了 `pid` 进行了区分关联。

所以现在只需要对这个词法解析器进行封装，便可以提供一个简单的 `API` 来获取表中的数据了。

![](https://i.loli.net/2020/03/23/1V8vsNFdxMLiRlY.jpg)


# 总结

到此整个词法解析器的全部内容都已经完成了，虽然实现的是一个小功能，但我自己花的时间可不少，其中光复习编译原理就让人头疼。

但这还只是整个编译语言知识点的冰山一角，后续还有语法、语义、中间、目标代码等一系列内容，都是一个比一个难啃。

其实我相信大多数人和我想法一样，这个东西太底层而且枯燥，真正从事这方面工作的也都是凤毛麟角，所以花这时间干啥呢？

所以我也决定这个弄完后就弃坑啦。

![](https://i.loli.net/2020/03/23/6bTSWEcxzaykX9N.jpg)

----

哈哈，开个玩笑，或许有生之年自己也能实现一门编程语言，当老了和儿子吹牛时也能有点资本。

本文所有源码及插件地址：

[https://github.com/crossoverJie/sqlalchemy-transfer](https://github.com/crossoverJie/sqlalchemy-transfer)

**大家看完记得点赞分享一键三连哦**

