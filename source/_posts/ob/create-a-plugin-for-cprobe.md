---
title: 手把手教你为开源项目贡献代码
date: 2024/01/25 19:49:09
categories:
  - OB
tags:
- OpenSource
- 开源
---
# 背景
前段时间无意间看到一篇公众号 [招贤令：一起来搞一个新开源项目](https://mp.weixin.qq.com/s/T8B3XnXd30vT7OvsFTnaFw)，作者介绍他想要做一个开源项目：[cprobe](https://github.com/cprobe/cprobe) 用于整合目前市面上散落在各地的 `Exporter`，统一进行管理。

比如我们常用的 `blackbox_exporter/mysqld_exporter` 等。

> 以往的每一个 Exporter 都需要单独部署运维。

<!--more-->
同时又完全兼容 `Prometheus` 生态，也可以复用现有的监控面板。

恰好这段时间我也在公司从事可观测性相关的业务，发现这确实是一个痛点。

于是便一直在关注这个项目，同时也做了些贡献；因为该项目的核心是用于整合 exporter，所以为其编写插件也是非常重要的贡献了。
# 编写插件

整个项目执行流程图如下：
![](https://s2.loli.net/2024/01/25/SihX4C5PN8IeR3Z.png)



可以看到编写插件最核心的便是自定义插件解析自定义的配置文件、抓取指标的逻辑。

比如我们需要在配置中指定抓取目标的域名、抓取规则等。

这里  `cprobe` 已经抽象出了两个接口，我们只需要做对应的实现即可。

```go
type Plugin interface {  
    // ParseConfig is used to parse config  
    ParseConfig(baseDir string, bs []byte) (any, error)  
    // Scrape is used to scrape metrics, cfg need to be cast specific cfg  
    Scrape(ctx context.Context, target string, cfg any, ss *types.Samples) error  
}
```

下面就以我之前编写的 [Consul](https://github.com/cprobe/cprobe/pull/29) 为例。

```yaml
# Allows any Consul server (non-leader) to service a read.  
allow_stale = true  
  
# === CA  
# File path to a PEM-encoded certificate authority used to validate the authenticity of a server certificate.  
ca_file = "/etc/consul.d/consul-agent-ca.pem"  
  
# File path to a PEM-encoded certificate used with the private key to verify the exporter's authenticity.  
cert_file = "/etc/consul.d/consul-agent.pem"  
  
# Generate a health summary for each service instance. Needs n+1 queries to collect all information.  
health_summary = true  
  
# File path to a PEM-encoded private key used with the certificate to verify the exporter's authenticity  
key_file = "/etc/consul.d/consul-agent-key.pem"  
  
# Disable TLS host verification.  
insecure = false
```

这里每个插件的配置都不相同，所以我们需要将配置解析到具体的结构体中。

```go
func (*Consul) ParseConfig(baseDir string, bs []byte) (any, error) {  
    var c Config  
    err := toml.Unmarshal(bs, &c)  
    if err != nil {  
       return nil, err  
    }  
  
    if c.Timeout == 0 {  
       c.Timeout = time.Millisecond * 500  
    }  
    return &c, nil  
}
```
解析配置文件没啥好说的，根据自己的逻辑实现即可，可能会配置一些默认值而已。

---

下面是核心的抓取逻辑，本质上就是使用对应插件的 `Client` 获取一些核心指标封装为 `Prometheus` 的 `Metric`，然后由 `cprobe` 写入到远端的 `Prometheus` 中(或者是兼容 `Prometheus` 的数据库中)。

```go

// Create client
config.HttpClient.Timeout = opts.Timeout  
config.HttpClient.Transport = transport  
  
client, err := consul_api.NewClient(config)  
if err != nil {  
    return nil, err  
}  
  
var requestLimitChan chan struct{}  
if opts.RequestLimit > 0 {  
    requestLimitChan = make(chan struct{}, opts.RequestLimit)  
}

```

![](https://s2.loli.net/2024/01/25/Hbnqz36wSDohuBJ.png)
所有的指标数据都是通过对应的客户端获取。

如果是迁移一个存在的  export 到 cprobe 中时，这些抓取代码我们都可以直接复制对应 [repo](https://github.com/prometheus/consul_exporter) 中的代码。

比如我就是参考的：[https://github.com/prometheus/consul_exporter](https://github.com/prometheus/consul_exporter)

除非我们是重新写一个插件，不然对于一些流行的库或者是中间件都已经有对应的 `exporter` 了。

具体的列表可以参考这里：
[https://prometheus.io/docs/instrumenting/exporters/](https://prometheus.io/docs/instrumenting/exporters/)

![](https://s2.loli.net/2024/01/25/6DEKwyWqA3MBm8f.png)

之后便需要在对应的插件目录(`./conf.d`)创建我们的配置文件：
![](https://s2.loli.net/2024/01/25/BJuyoqNtmvZ15wr.png)


为了方便测试，可以在启动 cprobe 时添加 `-no-writer` 让指标打印在控制台，从而方便调试。

# 总结

之前就有人问我有没有毕竟好上手的开源项目，这不就来了吗？

正好目前项目创建时间不长，代码和功能也比较简单，同时还有可观察系统大佬带队，确实是一个非常适合新手参与的开源项目。

项目地址：

[https://github.com/cprobe/cprobe](https://github.com/cprobe/cprobe)

# 私货
![](https://s2.loli.net/2024/01/25/2K3um8dPlfneyLw.png)

最后夹带一点私货：前两天帮一个读者朋友做了一次付费的技术咨询（主要是关于 Pulsar 相关的），也是我第一次做付费内容，这种拿人钱财替人消灾难道就是知识付费的味道吗😂？

![](https://s2.loli.net/2024/01/25/LJq6xlowRmdnrHv.png)

所以我就趁热打铁在朋友圈发了个广告，没想到又有个朋友找我做关于职场相关咨询，最后能帮助到对方自己也很开心。

其实经常也有人通过社媒、邮件等渠道找我帮忙看问题，一些简单的我通常也会抽时间回复。

但后面这位朋友也提到，如果我不是付费，他也不好意思来找我聊这些内容，毕竟涉及到一些隐私，同时也需要占用双方 1～2 小时的时间。

这样明码标价的方式确实也能更方便的沟通，同时也能减轻对方的心里负担，直接从白嫖转为付费大佬。

铺垫了这么多，主要目的是想进行一个小范围的尝试，如果对以下内容感兴趣的朋友欢迎加我微信私聊：

> 包括但不限于技术、职场、开源等我有经验的行业都可以聊。

![](https://s2.loli.net/2024/01/25/brqMxl5ZBvRz3mu.jpg)

反馈不错的话也需要可以作为我的长期副业做下去。
#Blog 