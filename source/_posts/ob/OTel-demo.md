---
title: 实操 OpenTelemetry：通过 Demo 掌握微服务监控的艺术
date: 2024/05/26 10:49:02
categories:
  - OB
tags:
- OpenTelemetry
---


# 前言

在上一篇文章 [OpenTelemetry 实践指南：历史、架构与基本概念](https://crossoverjie.top/2024/05/21/ob/OpenTelemetry-getstart/)中回顾了可观测性的历史以及介绍了一些 OpenTelemetry 的基础概念，同时也介绍了 OpenTelemetry 社区常用的开源项目。

基础背景知识了解后，这篇就来介绍一下使用 OpenTelemetry 如何实战部署应用，同时在一个可视化页面查看 trace、metric 等信息。

<!--more-->

# 项目介绍

我们参考官方文档构建几个 spring boot 、Golang 项目再配合 Agent 其实也可以很方便的集成 OpenTelemetry。

但是要完整的体验 OpenTelemetry 的所有功能，包含 trace、logs、metrics，还有社区这么多语言的支持其实还是比较麻烦的。

我们还需要单独部署 collector、存储的 backend service 等组件、包括 trace UI 展示所需要的 Jaeger，metric 所需要的 grafana 等。

这些所有东西都自己从头弄的话还是比较费时，不过好在社区已经将这些步骤都考虑到了。

特地为大家写了一个 [opentelemetry-demo](https://github.com/open-telemetry/opentelemetry-demo)。

这个项目模拟了一个微服务版本的电子商城，主要包含了以下一些项目：

| Service                                   | Language      | Description                                                                                                                          |
| ----------------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| [accountingservice](accounting/)          | Go            | 处理和计算订单数据                                                                   |
| [adservice](ad/)                          | Java          | 广告服务                                                                                      |
| [cartservice](cart/)                      | .NET          | 购物车服务，主要会依赖 Redis                                                              |
| [checkoutservice](checkout/)              | Go            | checkout                               |
| [currencyservice](currency/)              | C++           | 货币转换服务，提供了较高的 QPS 能力。    |
| [emailservice](email/)                    | Ruby          | 邮件服务                                                                                     |
| [frauddetectionservice](fraud-detection/) | Kotlin        | 风控服务                                                                         |
| [frontend](frontend/)                     | JavaScript    | 前端应用 |
| [loadgenerator](load-generator/)          | Python/Locust | 模拟压测服务                                                 |
| [paymentservice](payment/)                | JavaScript    | 支付服务                                       |
| [productcatalogservice](product-catalog/) | Go            | 商品服务                           |
| [quoteservice](quote/)                    | PHP           | 成本服务                                                           |
| [recommendationservice](recommendation/)  | Python        | 推荐服务                                                                         |
| [shippingservice](shipping/)              | Rust          | shipping service                                  |
可以发现在这个 demo 中提供了许多的服务，而且包含了几乎所有主流的语言，可以很好的模拟我们实际的使用场景了。

![](https://s2.loli.net/2024/04/20/NahleoLGbv9tSuE.png)


通过这张图可以更直观的查看各个服务之间的关系。

整体来说前端所有的请求都会通过 `front-end-proxy` 这个组件代理，最终再由 front 这个服务进行转发到不同的后端服务中。

---


![](https://s2.loli.net/2024/04/20/wLVI1mSzYKjt2Fo.png)
除了一个项目的架构图之外，还有一个关于 OpenTelemetry 的数据流转图。

在 OpenTelemetry 中数据流转是它的特点也是非常重要的核心，这点在上一篇文章中讲过，用户可以自由定制数据的流转以及任意的处理数据，在这个图中就将数据流转可视化了。

- 客户端可以通过 OTLP 协议或者是 HTTP 将数据上传到 OTel Collector 中。
- 在 collector 中会根据我们配置的 Process pipeline 处理数据。
- Metric 数据通过  OTLP HTTP exporter 将数据导入到 Prometheus 中。
	- [Prometheus](https://github.com/prometheus/prometheus/pull/12571) 已经于 23 年七月份支持 OTLP 格式的 metric 数据导入了。
- Trace 数据则是通过 OTLP Exporter 写入到 Jaeger 中进行存储，最后通过 Jaeger 的 UI 进行查询展示。
- 而存入 Prometheus 中的 metric 数据则是有 grafana 进行查询。

> 关于 collector 的配置会在后文讲解。

# 部署

接下来便是安装 Demo 了，我更推荐使用 helm 安装。

这里的版本要求是：
-  Kubernetes 1.24+
- Helm 3.9+

```shell
helm repo add open-telemetry https://open-telemetry.github.io/opentelemetry-helm-charts
helm repo update
helm install my-otel-demo open-telemetry/opentelemetry-demo
```

这样就可以很简单的将 demo 所涉及到的所有组件和服务都安装到 default 命名空间中。

```shell
helm show values open-telemetry/opentelemetry-demo > demo.yaml
```
不过在安装前还是建议先导出一份 value.yaml，之后可以使用这个 yaml 定制需要安装的组件。

在这个 yaml 中我们可以看到有哪些组件和服务可以定制：
![](https://s2.loli.net/2024/04/20/oe2S1fr3xPcypB4.png)
可以看到这里包含了我们刚才提到的所有服务，以及这些服务所依赖的 Kafka、redis、Prometheus 等中间件，都可以自己进行定制修改。

![](https://s2.loli.net/2024/04/20/VP5GvtszWolSBnf.png)
当所有的 Pod 都成功运行之后表示安装成功。

> 正常情况下安装不会有什么问题，最大可能的问题就是镜像拉取失败，此时我们可以先在本地手动 docker pull 下来镜像后再上传到私服，然后修改 deployment 中的镜像地址即可。



## 暴露服务

为了方便使用我们可以用这个 demo 进行测试，还需要将 front-proxy 的服务暴露出来可以在本地访问：

```shell
kubectl port-forward svc/my-otel-demo-frontendproxy 8080:8080
```

| Component | Path |
| ---- | ---- |
| Shop 首页 | <http://localhost:8080> |
| Grafana | <http://localhost:8080/grafana> |
| 压测页面 | <http://localhost:8080/loadgen> |
| Jaeger UI | <http://localhost:8080/jaeger/ui> |
正常情况下就可以打开这些页面进行访问了。

不过使用 port-forward 转发的方式只是临时方案，使用 ctrl+c 就会停止暴露服务，所以如果想要一个稳定的访问链接时便可以配置一个 ingress。

```yaml
components:
  frontendProxy:
    ingress:
      enabled: true
      annotations: {}
      hosts:
        - host: otel-demo.my-domain.com
          paths:
            - path: /
              pathType: Prefix
              port: 8080

```

在之前的 helm 的 value.yaml 中配置即可，本地测试的话需要将这个 host 和 ingress 暴露出来的 IP 进行绑定才可以使用这个域名机进行访问。

更多关于 ingress 的使用可以参考我之前的文章：
- [k8s入门到实战-使用Ingress](https://crossoverjie.top/2023/09/15/ob/k8s-Ingress/)

当然简单起见也可以直接将 front-proxy 的 service 类型改为 LoadBalancer。（默认是 ClusterIP 只可以在集群内访问）

这样就可以直接通过这个 service 的 IP 进行访问了。

```yaml
components:
  frontendProxy:
    service:
      type: LoadBalancer
```

 > 不过需要注意的是如果 demo 安装完成之后是不可以再次修改 service 的类型的，需要手动这个 service 删掉之后再次新建才可以。
 
 临时测试使用的话还是推荐直接使用 port-forward 进行转发。
# 查看 Trace
通过之前的项目架构图可以得知，我们在项目首页刷新会直接请求 AdService 来获取广告。

为了简单起见我们只查询这一链路的调用情况：
![](https://s2.loli.net/2024/04/21/t6a4KvOhSne9yfu.png)

打开 http://localhost:8080/jaeger/ui/search Jeager 的 UI 页面便可以筛选服务，之后点击查找 Traces 就可以列出一段时间内的访问 trace。

![](https://s2.loli.net/2024/04/21/v8nVLxweyCO9NMm.png)
可以看到这个请求链路是从前端访问到 adService 中的 `getAds()`接口，然后在这个接口中再访问了 `getAdsByCategory` 函数。
![](https://s2.loli.net/2024/04/21/3UXmHsCSLFguRZK.png)

最终在源码中也可以看到符合链路的调用代码。

> 在刚才的链路图的右下角有一个 spanID，整个 trace 是由这些小的 span 组成，每一个 span 也会有唯一 spanID； trace 也会有一个 traceID 将这些 span 串联起来；更多关于 trace 的内容会在后面的文章进行分析。


## 查看 Metrics
我们再打开 grafana 便可以看到刚才访问的 adService 的延迟和接口的 QPS 情况：
![](https://s2.loli.net/2024/04/21/29BlRATOnpkCQwS.png)

---

在opentelemetry-collector-data-flow 面板中还可以看到 OpenTelemetry 的数据流转。
![](https://s2.loli.net/2024/04/21/Tbtiv3gzY5xZIH1.png)

> 更多监控信息可以查看其它的面板。

而刚才面板中的数据流转规则则是在我们的 [collector](https://github.com/open-telemetry/opentelemetry-demo/blob/main/src/otelcollector/otelcol-config.yml) 中进行配置的：

```yaml

receivers:
  otlp:
    protocols:
      grpc:
      http:
        cors:
          allowed_origins:
            - "http://*"
            - "https://*"
  httpcheck/frontendproxy:
    targets:
      - endpoint: http://frontendproxy:${env:ENVOY_PORT}

exporters:
  debug:
  otlp:
    endpoint: "jaeger:4317"
    tls:
      insecure: true
  otlphttp/prometheus:
    endpoint: "http://prometheus:9090/api/v1/otlp"
    tls:
      insecure: true
  opensearch:
    logs_index: otel
    http:
      endpoint: "http://opensearch:9200"
      tls:
        insecure: true

processors:
  batch:

connectors:
  spanmetrics:

service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [batch]
      exporters: [otlp, debug, spanmetrics]
    metrics:
      receivers: [httpcheck/frontendproxy, otlp, spanmetrics]
      processors: [batch]
      exporters: [otlphttp/prometheus, debug]
    logs:
      receivers: [otlp]
      processors: [batch]
      exporters: [opensearch, debug]
```
重点的就是这里的 `service.piplines`，可以进行任意的组装。

更多关于 collector 的配置也会在后续文章中继续讲解。

我们也可以继续访问这个 demo 网站，模拟加入购物车、下单等行为，再结合 trace 和 metric 观察系统的变化。

这样一个完整的 OpenTelemetry-Demo 就搭建完毕了，我们实际在生产环境使时完全可以参考这个 demo 进行配置，可以少踩很多坑。


参考链接：
- https://github.com/open-telemetry/opentelemetry-demo/blob/main/src/adservice/Dockerfile
- https://github.com/open-telemetry/opentelemetry-demo
- https://github.com/prometheus/prometheus/pull/12571
- https://github.com/open-telemetry/opentelemetry-demo/blob/main/src/otelcollector/otelcol-config.yml