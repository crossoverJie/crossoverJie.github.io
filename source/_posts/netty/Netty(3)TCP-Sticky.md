---
title: Netty(三) 什么是 TCP 拆、粘包？如何解决？
date: 2018/08/03 00:01:14       
categories: 
- Netty
tags: 
- 拆包
- 粘包
- protobuf
---

![](https://i.loli.net/2019/05/08/5cd1d26cc6ea5.jpg)


## 前言

记得前段时间我们生产上的一个网关出现了故障。

这个网关逻辑非常简单，就是接收客户端的请求然后解析报文最后发送短信。

但这个请求并不是常见的 HTTP ，而是利用 Netty 自定义的协议。

> 有个前提是：网关是需要读取一段完整的报文才能进行后面的逻辑。

问题是有天突然发现网关解析报文出错，查看了客户端的发送日志也没发现问题，最后通过日志发现收到了许多**不完整的报文**，有些还多了。

于是想会不会是 TCP 拆、粘包带来的问题，最后利用 Netty 自带的拆包工具解决了该问题。

这便有了此文。

<!--more-->

### TCP 协议

问题虽然解决了，但还是得想想原因，为啥会这样？打破砂锅问到底才是一个靠谱的程序员。


这就得从 TCP 这个协议说起了。

TCP 是一个面向字节流的协议，它是性质是流式的，所以它并没有分段。就像水流一样，你没法知道什么时候开始，什么时候结束。

所以他会根据当前的套接字缓冲区的情况进行拆包或是粘包。

下图展示了一个 TCP 协议传输的过程：

![](https://i.loli.net/2019/05/08/5cd1d26dcc48d.jpg)

发送端的字节流都会先传入缓冲区，再通过网络传入到接收端的缓冲区中，最终由接收端获取。

当我们发送两个完整包到接收端的时候：

![](https://i.loli.net/2019/05/08/5cd1d26e3e083.jpg)

正常情况会接收到两个完整的报文。

---

但也有以下的情况：

![](https://i.loli.net/2019/05/08/5cd1d26ea061e.jpg)

接收到的是一个报文，它是由发送的两个报文组成的，这样对于应用程序来说就很难处理了（这样称为粘包）。

---


![](https://i.loli.net/2019/05/08/5cd1d26f1dcce.jpg)

还有可能出现上面这样的虽然收到了两个包，但是里面的内容却是互相包含，对于应用来说依然无法解析（拆包）。


对于这样的问题只能通过上层的应用来解决，常见的方式有：

- 在报文末尾增加换行符表明一条完整的消息，这样在接收端可以根据这个换行符来判断消息是否完整。
- 将消息分为消息头、消息体。可以在消息头中声明消息的长度，根据这个长度来获取报文（比如 808 协议）。
- 规定好报文长度，不足的空位补齐，取的时候按照长度截取即可。

以上的这些方式我们在 Netty 的 pipline 中里加入对应的解码器都可以手动实现。

但其实 Netty 已经帮我们做好了，完全可以开箱即用。

比如：

- `LineBasedFrameDecoder` 可以基于换行符解决。
- `DelimiterBasedFrameDecoder `可基于分隔符解决。
- `FixedLengthFrameDecoder `可指定长度解决。


## 字符串拆、粘包

下面来模拟一下最简单的字符串传输。

还是在之前的

[https://github.com/crossoverJie/netty-action](https://github.com/crossoverJie/netty-action)

进行演示。

在 Netty 客户端中加了一个入口可以循环发送 100 条字符串报文到接收端：

```java
    /**
     * 向服务端发消息 字符串
     * @param stringReqVO
     * @return
     */
    @ApiOperation("客户端发送消息，字符串")
    @RequestMapping(value = "sendStringMsg", method = RequestMethod.POST)
    @ResponseBody
    public BaseResponse<NULLBody> sendStringMsg(@RequestBody StringReqVO stringReqVO){
        BaseResponse<NULLBody> res = new BaseResponse();

        for (int i = 0; i < 100; i++) {
            heartbeatClient.sendStringMsg(stringReqVO.getMsg()) ;
        }

        // 利用 actuator 来自增
        counterService.increment(Constants.COUNTER_CLIENT_PUSH_COUNT);

        SendMsgResVO sendMsgResVO = new SendMsgResVO() ;
        sendMsgResVO.setMsg("OK") ;
        res.setCode(StatusEnum.SUCCESS.getCode()) ;
        res.setMessage(StatusEnum.SUCCESS.getMessage()) ;
        return res ;
    }
    
    
    
    /**
     * 发送消息字符串
     *
     * @param msg
     */
    public void sendStringMsg(String msg) {
        ByteBuf message = Unpooled.buffer(msg.getBytes().length) ;
        message.writeBytes(msg.getBytes()) ;
        ChannelFuture future = channel.writeAndFlush(message);
        future.addListener((ChannelFutureListener) channelFuture ->
                LOGGER.info("客户端手动发消息成功={}", msg));

    }
```

服务端直接打印即可：

```java
    @Override
    protected void channelRead0(ChannelHandlerContext ctx, String msg) throws Exception {
        LOGGER.info("收到msg={}", msg);

    }
```

顺便提一下，这里加的有一个字符串的解码器：`.addLast(new StringDecoder())` 其实就是把消息解析为字符串。

```java
    @Override
    protected void decode(ChannelHandlerContext ctx, ByteBuf msg, List<Object> out) throws Exception {
        out.add(msg.toString(charset));
    }
```


在 Swagger 中调用了客户端的接口用于给服务端发送了 100 次消息：

![](https://i.loli.net/2019/05/08/5cd1d2700caaf.jpg)

正常情况下接收端应该打印 100 次 `hello` 才对，但是查看日志会发现：

![](https://i.loli.net/2019/05/08/5cd1d276b04f8.jpg)

收到的内容有完整的、多的、少的、拼接的；这也就对应了上面提到的拆包、粘包。


该怎么解决呢？这便可采用之前提到的 `LineBasedFrameDecoder` 利用换行符解决。


### 利用 LineBasedFrameDecoder 解决问题

`LineBasedFrameDecoder` 解码器使用非常简单，只需要在 pipline 链条上添加即可。

```java
//字符串解析,换行防拆包
.addLast(new LineBasedFrameDecoder(1024))
.addLast(new StringDecoder())
```

构造函数中传入了 1024 是指报的长度最大不超过这个值，具体可以看下文的源码分析。

然后我们再进行一次测试看看结果：

> 注意，由于 LineBasedFrameDecoder 解码器是通过换行符来判断的，所以在发送时，一条完整的消息需要加上 `\n`。

![](https://i.loli.net/2019/05/08/5cd1d278852a8.jpg)

最终的结果：
![](https://i.loli.net/2019/05/08/5cd1d27c66730.jpg)

仔细观察日志，发现确实没有一条被拆、粘包。


### LineBasedFrameDecoder 的原理

目的达到了，来看看它的实现原理：

![](https://i.loli.net/2019/05/08/5cd1d2807657f.jpg)

1. 第一步主要就是 `findEndOfLine` 方法去找到当前报文中是否存在分隔符，存在就会返回分隔符所在的位置。
2. 判断是否需要丢弃，默认为 false ，第一次走这个逻辑（下文会判断是否需要改为 true）。
3. 如果报文中存在换行符，就会将数据截取到那个位置。
4. 如果不存在换行符（有可能是拆包、粘包），就看当前报文的长度是否大于预设的长度。大于则需要缓存这个报文长度，并将 discarding 设为 true。
5. 如果是需要丢弃时，判断是否找到了换行符，存在则需要丢弃掉之前记录的长度然后截取数据。
6. 如果没有找到换行符，则将之前缓存的报文长度进行累加，用于下次抛弃。


从这个逻辑中可以看出就是寻找报文中是否包含换行符，并进行相应的截取。

由于是通过缓冲区读取的，所以即使这次没有换行符的数据，只要下一次的报文存在换行符，上一轮的数据也不会丢。


## 高效的编码方式 Google Protocol

上面提到的其实就是在解码中进行操作，我们也可以自定义自己的拆、粘包工具。

编解码的主要目的就是为了可以编码成字节流用于在网络中传输、持久化存储。

Java 中也可以实现 Serializable 接口来实现序列化，但由于它性能等原因在一些 RPC 调用中用的很少。

而 `Google Protocol` 则是一个高效的序列化框架，下面来演示在 Netty 中如何使用。


### 安装

首先第一步自然是安装：

在[官网](https://github.com/google/protobuf/releases/tag/v3.6.1)下载对应的包。

本地配置环境变量：

![](https://i.loli.net/2019/05/08/5cd1d281120d5.jpg)

当执行 `protoc --version` 出现以下结果表明安装成功：

![](https://i.loli.net/2019/05/08/5cd1d2820a66f.jpg)

### 定义自己的协议格式

接着是需要按照官方要求的语法定义自己的协议格式。

比如我这里需要定义一个输入输出的报文格式：

BaseRequestProto.proto:

```java
syntax = "proto2";

package protocol;

option java_package = "com.crossoverjie.netty.action.protocol";
option java_outer_classname = "BaseRequestProto";

message RequestProtocol {
  required int32 requestId = 2;
  required string reqMsg = 1;
  

}
```

BaseResponseProto.proto:

```java
syntax = "proto2";

package protocol;

option java_package = "com.crossoverjie.netty.action.protocol";
option java_outer_classname = "BaseResponseProto";

message ResponseProtocol {
  required int32 responseId = 2;
  required string resMsg = 1;
  

}
```

再通过

```shell
protoc --java_out=/dev BaseRequestProto.proto BaseResponseProto.proto
```

protoc 命令将刚才定义的协议格式转换为 Java 代码，并生成在 `/dev` 目录。

只需要将生成的代码拷贝到我们的项目中，同时引入依赖：

```xml
<dependency>
	<groupId>com.google.protobuf</groupId>
	<artifactId>protobuf-java</artifactId>
	<version>3.4.0</version>
</dependency>
```

利用 Protocol 的编解码也非常简单：

```java
public class ProtocolUtil {

    public static void main(String[] args) throws InvalidProtocolBufferException {
        BaseRequestProto.RequestProtocol protocol = BaseRequestProto.RequestProtocol.newBuilder()
                .setRequestId(123)
                .setReqMsg("你好啊")
                .build();

        byte[] encode = encode(protocol);

        BaseRequestProto.RequestProtocol parseFrom = decode(encode);

        System.out.println(protocol.toString());
        System.out.println(protocol.toString().equals(parseFrom.toString()));
    }

    /**
     * 编码
     * @param protocol
     * @return
     */
    public static byte[] encode(BaseRequestProto.RequestProtocol protocol){
        return protocol.toByteArray() ;
    }

    /**
     * 解码
     * @param bytes
     * @return
     * @throws InvalidProtocolBufferException
     */
    public static BaseRequestProto.RequestProtocol decode(byte[] bytes) throws InvalidProtocolBufferException {
        return BaseRequestProto.RequestProtocol.parseFrom(bytes);
    }
}

```

利用 `BaseRequestProto` 来做一个演示，先编码再解码最后比较最终的结果是否相同。答案肯定是一致的。

利用 protoc 命令生成的 Java 文件里已经帮我们把编解码全部都封装好了，只需要简单调用就行了。

可以看出 Protocol 创建对象使用的是构建者模式，对使用者来说清晰易读，更多关于构建器的内容可以参考[这里](https://crossoverjie.top/2018/04/28/sbc/sbc7-Distributed-Limit/#Builder-%E6%9E%84%E5%BB%BA%E5%99%A8)。


更多关于 `Google Protocol` 内容请查看[官方开发文档](https://developers.google.com/protocol-buffers/docs/javatutorial)。

### 结合 Netty

Netty 已经自带了对 Google protobuf 的编解码器，也是只需要在 pipline 中添加即可。

server 端：

```java
// google Protobuf 编解码
.addLast(new ProtobufDecoder(BaseRequestProto.RequestProtocol.getDefaultInstance()))
.addLast(new ProtobufEncoder())
``` 



客户端：

```java
// google Protobuf 编解码

.addLast(new ProtobufDecoder(BaseResponseProto.ResponseProtocol.getDefaultInstance()))

.addLast(new ProtobufEncoder())
```

> 稍微注意的是，在构建 ProtobufDecoder 时需要显式指定解码器需要解码成什么类型。

我这里服务端接收的是 BaseRequestProto，客户端收到的是服务端响应的 BaseResponseProto 所以就设置了对应的实例。


同样的提供了一个接口向服务端发送消息，当服务端收到了一个特殊指令时也会向客户端返回内容：

```java
    @Override
    protected void channelRead0(ChannelHandlerContext ctx, BaseRequestProto.RequestProtocol msg) throws Exception {
        LOGGER.info("收到msg={}", msg.getReqMsg());

        if (999 == msg.getRequestId()){
            BaseResponseProto.ResponseProtocol responseProtocol = BaseResponseProto.ResponseProtocol.newBuilder()
                    .setResponseId(1000)
                    .setResMsg("服务端响应")
                    .build();
            ctx.writeAndFlush(responseProtocol) ;
        }

    }
```

在 swagger 中调用相关接口：

![](https://i.loli.net/2019/05/08/5cd1d28328230.jpg)

在日志可以看到服务端收到了消息，同时客户端也收到了返回：

![](https://i.loli.net/2019/05/08/5cd1d2840564c.jpg)

![](https://i.loli.net/2019/05/08/5cd1d284ab76f.jpg)

虽说 Netty 封装了 Google Protobuf 相关的编解码工具，其实查看它的编码工具就会发现也是利用上文提到的 api 实现的。

![](https://i.loli.net/2019/05/08/5cd1d287b83cd.jpg)


### Protocol 拆、粘包

Google Protocol 的使用确实非常简单，但还是有值的注意的地方，比如它依然会有拆、粘包问题。

不妨模拟一下：

![](https://i.loli.net/2019/05/08/5cd1d28e427ab.jpg)

连续发送 100 次消息看服务端收到的怎么样：

![](https://i.loli.net/2019/05/08/5cd1d29a34961.jpg)

会发现服务端在解码的时候报错，其实就是被拆、粘包了。

这点 Netty 自然也考虑到了，所以已经提供了相关的工具。

```java
//拆包解码
.addLast(new ProtobufVarint32FrameDecoder())
.addLast(new ProtobufVarint32LengthFieldPrepender())
```

只需要在服务端和客户端加上这两个编解码工具即可，再来发送一百次试试。

查看日志发现没有出现一次异常，100 条信息全部都接收到了。

![](https://i.loli.net/2019/05/08/5cd1d2a1158f4.jpg)

这个编解码工具可以简单理解为是在消息体中加了一个 32 位长度的整形字段，用于表明当前消息长度。


## 总结

网络这块同样是计算机的基础，由于近期在做相关的工作所以接触的比较多，也算是给大学补课了。

后面会接着更新 Netty 相关的内容，最后会产出一个高性能的 HTTP 以及 RPC 框架，敬请期待。

上文相关的代码：

[https://github.com/crossoverJie/netty-action](https://github.com/crossoverJie/netty-action)



## 号外
最近在总结一些 Java 相关的知识点，感兴趣的朋友可以一起维护。

> 地址: [https://github.com/crossoverJie/Java-Interview](https://github.com/crossoverJie/Java-Interview)




**欢迎关注公众号一起交流：**
