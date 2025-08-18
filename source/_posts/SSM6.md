---
title: SSM(六)跨域传输
date: 2016/10/18 13:44:54       
categories: 
- SSM
tags: 
- Java
- JSONP
- JSON
---
![](https://i.loli.net/2019/05/08/5cd1ba153e527.jpg)

# 前言
不知大家在平时的开发过程中有没有遇到过跨域访问资源的问题，我不巧在上周就碰到一个这样的问题，幸运的是在公司前端同学的帮忙下解决了该问题。

## 什么是跨域问题？
1. 只要协议、域名、端口有任何一个不同，都被当作是不同的域
2. 只要是在不同域中是无法进行通信的。

<!--more-->

基于以上的的出发点，我们又有跨域共享资源的需求(`譬如现在流行的前后端分离之后分别部署的情况`)，本文所采用的解决办法是`JSONP`，说到`JSONP`就会首先想到`JSON`。虽然只有一字之差但意义却完全不一样，首先科普一下`JSON`。


# JSON
> 其实现在`JSON`已经是相当流行了，只要涉及到前后端的数据交互大都都是采用的JSON(不管是web还是android和IOS)，所以我这里就举一个例子，就算是没有用过的同学也能很快明白其中的意思。

## PostMan
首先给大家安利一款后端开发的利器`PostMan`,可以用于模拟几乎所有的`HTTP`请求，在开发阶段调试后端接口非常有用。
这是一个Chrome插件，可以直接在google商店搜索直接下载(当然前提你懂得)。
之后界面就如下：

![](https://i.loli.net/2019/05/08/5cd1ba18947ba.jpg)

界面非常简洁，有点开发经验的童鞋应该都会使用，不太会用的直接google下就可以了比较简单。
接着我们就可以利用`PostMan`来发起一次请求获取`JSON`了。这里以我`SSM`项目为例,也正好有暴露一个JSON的接口。地址如下:
[http://www.crossoverjie.top/SSM/content_load](http://www.crossoverjie.top/SSM/content_load)。
直接在`POSTMAN`中的地址栏输入该地址，采用`GET`的方式请求，之后所返回的就是JSON格式的字符串。
由于`Javascript`原生的就支持JSON，所以解析起来非常方便。

# JSONP
好了，终于可以谈谈`JSONP`了。之前说道`JSONP`是用来解决跨域问题的，那么他是如何解决的呢。
经过我们开发界的前辈们发现，HTML中拥有`SRC`属性的标签都不受跨域的影响，比如：`<script>、<img>、<iframe>`标签。
由于JS原生支持JSON的解析，于是我们采用`<script>`的方式来处理跨域解析，代码如下一看就明白。
web端:
```html
<html lang="zh">
<head>
    <script type="text/javascript">
        $(document).ready(function(){
            $.ajax({
                type: "get",
                async: false,
                url: "http://www.crossoverjie.top/SSM/jsonpInfo?callback=getUser&userId=3",
                dataType: "jsonp",
                jsonp: "callback",//一般默认为:callback
                jsonpCallback:"getUser",//自定义的jsonp回调函数名称，默认为jQuery自动生成的随机函数名，也可以写"?"，jQuery会自动为你处理数据
                success: function(json){
                    /**
                     * 获得服务器返回的信息。
                     * 可以做具体的业务处理。
                     */
                    alert('用户信息：ID： ' + json.userId + ' ，姓名： ' + json.username + '。');
                },
                error: function(){
                    alert('fail');
                }
            });
        });
    </script>

</head>

<body oncontextmenu="return false">

</body>

</html>
```
其中我们采用了JQuery给我封装好的函数，这样就可以自动帮我们解析了。
首先我们来看下代码中的[http://www.crossoverjie.top/SSM/jsonpInfo?callback=getUser&userId=3](http://www.crossoverjie.top/SSM/jsonpInfo?callback=getUser&userId=3)这个地址返回的是什么内容，还是放到`POSTMAN`中执行如下：
![3](http://img.blog.csdn.net/20161018005211291)。
可以看到我们所传递的`callback`参数带着查询的数据又原封不动的返回给我们了，这样的话即使我们不使用`JQuery`给我封装好的函数，我们自定义一个和`callback`名称一样的函数一样是可以解析其中的数据的，只是`Jquery`帮我们做了而已。

前端没问题了，那么后端又是如何实现的呢？也很简单，如下：
```java
    @RequestMapping(value = "/jsonpInfo",method = { RequestMethod.GET })
    @ResponseBody
    public Object jsonpInfo(String callback,Integer userId) throws IOException {
        User user = userService.getUserById(userId);
        JSONPObject jsonpObject = new JSONPObject(callback,user) ;
        return jsonpObject ;
    }
```
后端采用了`jackson`中的`JSONPObject`这个类的一个构造方法，只需要将`callback`字段和需要转成`JSON`字符串的对象放进去即可。
需要主要的是需要使用`@ResponseBody`注解才能成功返回。

# 总结
其实网上还有其他的方法来处理跨域问题，不过我觉得这样的方式最为简单。同样JSONP也是有缺点的，比如：只支持`GET`方式的HTTP请求。
以上代码依然在博主的[SSM](https://github.com/crossoverJie/SSM)项目中，如有需要可以直接`FORK`。

> 项目地址：[https://github.com/crossoverJie/SSM.git](https://github.com/crossoverJie/SSM.git)

> 个人博客地址：[http://crossoverjie.top](http://crossoverjie.top)。

> GitHub地址：[https://github.com/crossoverJie](https://github.com/crossoverJie)。
