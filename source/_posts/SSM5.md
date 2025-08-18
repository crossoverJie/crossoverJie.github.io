---
title: SSM(五)基于webSocket的聊天室
date: 2016/9/4 21:20:17       
categories: 
- SSM
tags: 
- Java
- websocket
- HTML5
- ueditor
---

![](https://i.loli.net/2019/05/08/5cd1ba1710d06.jpg)

# 前言
不知大家在平时的需求中有没有遇到需要实时处理信息的情况，如站内信，订阅，聊天之类的。在这之前我们通常想到的方法一般都是采用轮训的方式每隔一定的时间向服务器发送请求从而获得最新的数据，但这样会浪费掉很多的资源并且也不是实时的，于是随着`HTML5`的推出带来了`websocket`可以根本的解决以上问题实现真正的实时传输。

## websocket是什么？
至于`websocket`是什么、有什么用这样的问题一Google一大把，这里我就简要的说些`websocket`再本次实例中的作用吧。
由于在本次实例中需要实现的是一个聊天室，一个实时的聊天室。如下图：

![1.gif](http://i.imgur.com/6of3Z5K.gif)

<!--more-->

采用`websocket`之后可以让前端和和后端像C/S模式一样实时通信，不再需要每次单独发送请求。由于是基于H5的所以对于老的浏览器如IE7、IE8之类的就没办法了，不过H5是大势所趋这点不用担心。

# 后端
既然推出了`websocket`，作为现在主流的Java肯定也有相应的支持，所以在`JavaEE7`之后也对`websocket`做出了规范，所以本次的代码理论上是要运行在`Java1.7`+和`Tomcat7.0+`之上的。
看过我前面几篇文章的朋友应该都知道本次实例也是运行在之前的[SSM](https://github.com/crossoverjie/ssm)之上的，所以这里就不再赘述了。
首先第一步需要加入`websocket`的依赖：
```xml
        <!-- https://mvnrepository.com/artifact/javax.websocket/javax.websocket-api -->
        <dependency>
            <groupId>javax.websocket</groupId>
            <artifactId>javax.websocket-api</artifactId>
            <version>1.1</version>
        </dependency>

        <dependency>
            <groupId>org.springframework</groupId>
            <artifactId>spring-websocket</artifactId>
            <version>${spring.version}</version>
        </dependency>
```
以上就是使用`websocket`所需要用到的包。`spring-websocket`这个主要是在之后需要在`websocket`的后端注入`service`所需要的。
之后再看一下后端的核心代码`MyWebSocket.java`
```java
package com.crossoverJie.controller;

/**
 * Created by Administrator on 2016/8/7.
 */
import com.crossoverJie.pojo.Content;
import com.crossoverJie.service.ContentService;
import org.apache.camel.BeanInject;
import org.apache.camel.EndpointInject;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.stereotype.Controller;
import org.springframework.web.context.support.SpringBeanAutowiringSupport;
import org.springframework.web.socket.server.standard.SpringConfigurator;

import java.io.IOException;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.concurrent.CopyOnWriteArraySet;

import javax.annotation.PostConstruct;
import javax.websocket.OnClose;
import javax.websocket.OnError;
import javax.websocket.OnMessage;
import javax.websocket.OnOpen;
import javax.websocket.Session;
import javax.websocket.server.ServerEndpoint;

//该注解用来指定一个URI，客户端可以通过这个URI来连接到WebSocket。
/**
  类似Servlet的注解mapping。无需在web.xml中配置。
 * configurator = SpringConfigurator.class是为了使该类可以通过Spring注入。
 */
@ServerEndpoint(value = "/websocket",configurator = SpringConfigurator.class)
public class MyWebSocket {
    //静态变量，用来记录当前在线连接数。应该把它设计成线程安全的。
    private static int onlineCount = 0;

    public MyWebSocket() {
    }

    @Autowired
    private ContentService contentService ;

    //concurrent包的线程安全Set，用来存放每个客户端对应的MyWebSocket对象。
    // 若要实现服务端与单一客户端通信的话，可以使用Map来存放，其中Key可以为用户标识
    private static CopyOnWriteArraySet<MyWebSocket> webSocketSet = new CopyOnWriteArraySet<MyWebSocket>();

    //与客户端的连接会话，需要通过它来给客户端发送数据
    private Session session;

    /**
     * 连接建立成功调用的方法
     * @param session  可选的参数。session为与某个客户端的连接会话，需要通过它来给客户端发送数据
     */
    @OnOpen
    public void onOpen(Session session){
        this.session = session;
        webSocketSet.add(this);     //加入set中
        addOnlineCount();           //在线数加1
        System.out.println("有新连接加入！当前在线人数为" + getOnlineCount());
    }

    /**
     * 连接关闭调用的方法
     */
    @OnClose
    public void onClose(){
        webSocketSet.remove(this);  //从set中删除
        subOnlineCount();           //在线数减1
        System.out.println("有一连接关闭！当前在线人数为" + getOnlineCount());
    }

    /**
     * 收到客户端消息后调用的方法
     * @param message 客户端发送过来的消息
     * @param session 可选的参数
     */
    @OnMessage
    public void onMessage(String message, Session session) {
        System.out.println("来自客户端的消息:" + message);
        //群发消息
        for(MyWebSocket item: webSocketSet){
            try {
                item.sendMessage(message);
            } catch (IOException e) {
                e.printStackTrace();
                continue;
            }
        }
    }

    /**
     * 发生错误时调用
     * @param session
     * @param error
     */
    @OnError
    public void onError(Session session, Throwable error){
        System.out.println("发生错误");
        error.printStackTrace();
    }

    /**
     * 这个方法与上面几个方法不一样。没有用注解，是根据自己需要添加的方法。
     * @param message
     * @throws IOException
     */
    public void sendMessage(String message) throws IOException{
        //保存数据到数据库
        Content content = new Content() ;
        content.setContent(message);
        SimpleDateFormat sm = new SimpleDateFormat("yyyy-MM-dd HH:mm:dd") ;
        content.setCreateDate(sm.format(new Date()));
        contentService.insertSelective(content) ;

        this.session.getBasicRemote().sendText(message);
        //this.session.getAsyncRemote().sendText(message);


    }

    public static synchronized int getOnlineCount() {
        return onlineCount;
    }

    public static synchronized void addOnlineCount() {
        MyWebSocket.onlineCount++;
    }

    public static synchronized void subOnlineCount() {
        MyWebSocket.onlineCount--;
    }

}
```
这就是整个`websocket`的后端代码。看起来也比较简单主要就是使用那几个注解。每当有一个客户端连入、关闭、发送消息都会调用各自注解的方法。这里我讲一下`sendMessage()`这个方法。
## websocket绕坑
在`sendMessage()`方法中我只想实现一个简单的功能，就是将每次的聊天记录都存到数据库中。看似一个简单的功能硬是花了我半天的时间。
我先是按照以前的惯性思维只需要在这个类中注入`service`即可。但是无论怎么弄每次都注入不进来都是`null`。
最后没办法只有google了，最后终于在神级社区`StackOverFlow`中找到了答案，就是前边所说的需要添加的第二个	`maven`依赖，然后加入`@ServerEndpoint(value = "/websocket",configurator = SpringConfigurator.class)`这个注解即可利用`Spring`注入了。接着就可以做消息的保存了。

# 前端
前端我采用了Bootstrap做的，不太清楚Bootstrap的童鞋建议先看下[官方文档](http://www.bootcss.com/)也比较简单。还是先贴一下代码：
```html
<%@ page language="java" import="java.util.*" pageEncoding="UTF-8" %>
<%
    String path = request.getContextPath();
    String basePath = request.getScheme() + "://" + request.getServerName() + ":" + request.getServerPort() + path + "/";
%>

<!DOCTYPE HTML>
<html>
<head>
    <base href="<%=basePath%>">
    <!-- Bootstrap -->
    <link rel="stylesheet"
          href="http://cdn.bootcss.com/bootstrap/3.3.5/css/bootstrap.min.css">
    <!-- HTML5 shim and Respond.js for IE8 support of HTML5 elements and media queries -->
    <!-- WARNING: Respond.js doesn't work if you view the page via file:// -->
    <!--[if lt IE 9]>
    <script src="//cdn.bootcss.com/html5shiv/3.7.2/html5shiv.min.js"></script>
    <script src="//cdn.bootcss.com/respond.js/1.4.2/respond.min.js"></script>
    <![endif]-->
    <script type="text/javascript" charset="utf-8" src="<%=path%>/ueditor/ueditor.config.js"></script>
    <script type="text/javascript" charset="utf-8" src="<%=path%>/ueditor/ueditor.all.min.js"> </script>
    <!--建议手动加在语言，避免在ie下有时因为加载语言失败导致编辑器加载失败-->
    <!--这里加载的语言文件会覆盖你在配置项目里添加的语言类型，比如你在配置项目里配置的是英文，这里加载的中文，那最后就是中文-->
    <script type="text/javascript" charset="utf-8" src="<%=path%>/ueditor/lang/zh-cn/zh-cn.js"></script>

    <title>聊天室</title>
</head>

<body data="/ssm">
<input id="text" type="text"/>
<button onclick="send()">发送</button>
<button onclick="closeWebSocket()">关闭连接</button>
<div id="message">
</div>


<div class="container-fluid">
    <div class="row">
        <div class="col-md-12">
            <div class="panel panel-primary">
                <div class="panel-heading">聊天室</div>
                <div id="msg" class="panel-body">

                </div>
                <div class="panel-footer">
                    在线人数<span id="onlineCount">1</span>人
                </div>
            </div>
        </div>
    </div>
</div>

<div class="container-fluid">
    <div class="row">
        <div class="col-md-12">
            <script id="editor" type="text/plain" style="width:1024px;height:200px;"></script>
        </div>
    </div>

</div>

<div class="container-fluid">
    <div class="row">
        <div class="col-md-12">
            <p class="text-right">
            <button onclick="sendMsg();" class="btn btn-success">发送</button>
            </p>
        </div>
    </div>

</div>

</body>

<script type="text/javascript">
    var ue = UE.getEditor('editor');
    var websocket = null;

    //判断当前浏览器是否支持WebSocket
    if ('WebSocket' in window) {
        websocket = new WebSocket("ws://192.168.0.102:8080/ssm/websocket");
    }
    else {
        alert("对不起！你的浏览器不支持webSocket")
    }

    //连接发生错误的回调方法
    websocket.onerror = function () {
        setMessageInnerHTML("error");
    };

    //连接成功建立的回调方法
    websocket.onopen = function (event) {
        setMessageInnerHTML("加入连接");
    };

    //接收到消息的回调方法
    websocket.onmessage = function (event) {
        setMessageInnerHTML(event.data);
    };

    //连接关闭的回调方法
    websocket.onclose = function () {
        setMessageInnerHTML("断开连接");
    };

    //监听窗口关闭事件，当窗口关闭时，主动去关闭websocket连接，
    // 防止连接还没断开就关闭窗口，server端会抛异常。
    window.onbeforeunload = function () {
        var is = confirm("确定关闭窗口？");
        if (is){
            websocket.close();
        }
    };

    //将消息显示在网页上
    function setMessageInnerHTML(innerHTML) {
        $("#msg").append(innerHTML+"<br/>")
    };

    //关闭连接
    function closeWebSocket() {
        websocket.close();
    }

    //发送消息
    function send() {
        var message = $("#text").val() ;
        websocket.send(message);
        $("#text").val("") ;
    }

    function sendMsg(){
        var msg = ue.getContent();
        websocket.send(msg);
        ue.setContent('');
    }
</script>

<!-- jQuery (necessary for Bootstrap's JavaScript plugins) -->
<script src="http://cdn.bootcss.com/jquery/1.11.3/jquery.min.js"></script>
<!-- Include all compiled plugins (below), or include individual files as needed -->
<script src="http://cdn.bootcss.com/bootstrap/3.3.5/js/bootstrap.min.js"></script>
<script type="text/javascript" src="<%=path%>/js/Globals.js"></script>
<script type="text/javascript" src="<%=path%>/js/websocket.js"></script>
</html>
```
其实其中重要的就是那几个JS方法，都写有注释。需要注意的是这里
```javascript
    //判断当前浏览器是否支持WebSocket
    if ('WebSocket' in window) {
        websocket = new WebSocket("ws://192.168.0.102:8080/ssm/websocket");
    }
    else {
        alert("对不起！你的浏览器不支持webSocket")
    }
```
当项目跑起来之后需要将这里的地址改为你项目的地址即可。
哦对了，我在这里采用了百度的一个`Ueditor`的富文本编辑器(虽然百度搜索我现在很少用了，但是这个编辑器确实还不错)，这个编辑器也比较简单只需要个性化的配置一下个人的需求即可。
## Ueditor相关配置
直接使用我项目运行的童鞋就不需要重新下载了，我将资源放在了webapp目录下的ueditor文件夹下面的。
值得注意的是我们首先需要将`jsp-->lib`下的jar包加入到项目中。加好之后会出现一个想下的箭头表示已经引入成功。
![](http://i.imgur.com/ZtHInpF.png)，之后修改该目录下的`config.json`文件，主要修改以下内容即可：
```json
    "imageAllowFiles": [".png", ".jpg", ".jpeg", ".gif", ".bmp"], /* 上传图片格式显示 */
    "imageCompressEnable": true, /* 是否压缩图片,默认是true */
    "imageCompressBorder": 1600, /* 图片压缩最长边限制 */
    "imageInsertAlign": "none", /* 插入的图片浮动方式 */
    "imageUrlPrefix": "http://192.168.0.102:8080/ssm", /* 图片访问路径前缀 */
    "imagePathFormat": "/ueditor/jsp/upload/image/{yyyy}{mm}{dd}/{time}{rand:6}",
```
这里主要是要修改`imageUrlPrefix`为你自己的项目地址就可以了。`ueditor`一个我认为很不错的就是他支持图片、多图、截图上传，而且都不需要手动编写后端接口，所有上传的文件、图片都会保存到项目发布出去的`jsp-->upload`文件夹下一看就明白了。更多关于`ueditor`的配置可以查看[官网](http://ueditor.baidu.com/website/)。
> 其中值得注意一点的是，由于项目采用了`Spring MVC`并拦截了所有的请求，导致静态资源不能访问，如果是需要用到上传`txt`文件之类的需求可以参照`web.xml`中修改，如下:
```xml
<servlet-mapping>
    <servlet-name>default</servlet-name>
    <url-pattern>*.txt</url-pattern>
</servlet-mapping>
```
这样就可以访问txt文件了，如果还需要上传PPT之类的就以此类推。

# 总结
这样一个简单的基于`websocket`的聊天室就算完成了，感兴趣的朋友可以将项目部署到外网服务器上这样好基友之间就可以愉快的聊(zhuang)天(bi)了。
当然这只是一个简单的项目，感兴趣的朋友再这基础之上加入实时在线人数，用户名和IP之类的。

> 项目地址：[https://github.com/crossoverJie/SSM.git](https://github.com/crossoverJie/SSM.git)
> 个人博客地址：[http://crossoverjie.top](http://crossoverjie.top)。
> GitHub地址：[https://github.com/crossoverJie](https://github.com/crossoverJie)。
