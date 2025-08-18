---
title: 使用 ChatGPT 碰到的坑
date: 2023/07/18 11:47:52
categories: 
- ChatGPT
tags: 
- Syslog
- Go
---

![](https://s2.loli.net/2023/07/14/YtqXVJmfNokCwyE.png)

最近在使用 ChatGPT 的时候碰到一个小坑，因为某些特殊情况我需要使用 `syslog` 向 `logbeat` 中发送日志。

由于这是一个比较古老的协议，确实也没接触过，所以就想着让 ChatGPT 帮我生成个例子。

<!--more-->

原本我已经在  Go  中将这个流程跑通，所以其实只需要将代码转换为 Java 就可以了，这个我还是很信任 `ChatGPT` 的；
> 现在我挺多结构化数据的转换都交给了 ChatGPT，省去了不少小工具。

于是便有了这段对话：
![image.png](https://s2.loli.net/2023/07/17/6MHlRKOtZ2rJocd.png)
![image.png](https://s2.loli.net/2023/07/17/SzCGBuiN6AvR7Zo.png)
看起来挺正常的，我那过来改改确实也能用。


---
直到快上线的时候，我发现一些元信息丢失了，比如日志生产者的 `hostname, PID` 等，然而这个信息在 Go 却没有丢失。

于是我反复调试了之前生成的代码，依然没有找到问题。

没办法，就只有去翻翻 Go 源码，想看看最终发出去的数据长什么样子，最后看到这样几行代码：
![](https://s2.loli.net/2023/07/17/kJnoR4stKwYvCg8.png)
![image.png](https://s2.loli.net/2023/07/17/tOHvgx2ZzyrAEh9.png)

这样一看就很清晰了，只是按照 `<%d>%s %s %s[%d]: %s%s` 的格式将生成的字符串通过网络发送出去。

既然这样 Java 代码也很好写了:

```java
Socket socket = new Socket(hostname,port);
socket.setKeepAlive(true);
OutputStream os = socket.getOutputStream();
PrintWriter pw = new PrintWriter(os, true);

String format = String.format("<%d>%s %s %s[%d]: %s%s", 6 , rfc3164DateFormat.format(new Date()), "test", "test", 0, message, "\n");

pw.println(format);
```
经过测试数据终于对了。

之后我就在想这么简单的一个问题 Google 上不可能没有吧，于是直接搜索了 `Java syslog` 关键字，结果直接就有一个现成的库。
![](https://s2.loli.net/2023/07/17/Fm6XBnOdxQ9PAKY.png)


![](https://s2.loli.net/2023/07/17/c7PCjmZnboReQtp.png)

而且实现也是类似的。

我相信应该有不少朋友也有被 ChatGPT 一本正经的胡说八道误导过，至少在当前的环境下一些简单的东西我还是决定优先 `Google`。