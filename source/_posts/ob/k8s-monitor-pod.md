---
title: k8s 云原生应用如何接入监控
date: 2025/01/02 14:00:50
categories:
  - OB
  - kubernetes
tags:
- kubernetes
---

前段时间有朋友问我如何在 kubernetes 里搭建监控系统，恰好在公司也在维护内部的可观测平台，正好借这个机会整理下目前常见的自建监控方案。

一个完整的监控系统通常包含以下的内容：
- 指标暴露：将系统内部需要关注的指标暴露出去
- 指标采集：收集并存储暴露出来的指标
- 指标展示：以各种图表展示和分析收集到的数据
- 监控告警：当某些关键指标在一定时间周期内出现异常时，可以及时通知相关人员

![image.png](https://s2.loli.net/2024/12/20/nAOS5E1YzWDoZyF.png)


对于 k8s 的监控通常分为两个部分：
- k8s 自带的系统组建
- 业务 Pod 暴露出来的监控指标

<!--more-->
# 系统组建
对于 kubernetes 系统组建可以由 `cAdvisor` 提供监控能力，默认情况下这个功能是开箱即用的，我们只需要在 Prometheus 中配置相关的任务抓取即可：

```yaml
- job_name: nodeScrape/monitoring/cadvisor-scrape/0
  scrape_interval: 30s
  scrape_timeout: 15s
  scheme: https
  bearer_token_file: /var/run/secrets/kubernetes.io/serviceaccount/token
  tls_config:
    insecure_skip_verify: true
  relabel_configs:
  - source_labels: [__meta_kubernetes_node_name]
    target_label: node
  - action: replace
    source_labels: [__meta_kubernetes_node_name]
    separator: ;
    target_label: __address__
    regex: (.*)
    replacement: kubernetes.default.svc:443
  - action: replace
    source_labels: [__meta_kubernetes_node_name]
    separator: ;
    target_label: __metrics_path__
    regex: (.+)
    replacement: /api/v1/nodes/${1}/proxy/metrics/cadvisor

  kubernetes_sd_configs:
  - role: node
```

![image.png](https://s2.loli.net/2024/12/20/RhKZGp94sUTbvFa.png)
这样的话就可以监控 k8s 的内存、CPU 之类的数据。

具体提供了哪些指标可以参考这里：
https://github.com/google/cadvisor/blob/master/docs/storage/prometheus.md#prometheus-container-metrics

也可以找一些常用的监控面板:
https://grafana.com/grafana/dashboards/13077-kubernetes-monitoring-dashboard-kubelet-cadvisor-node-exporter/

k8s 不但提供了 cAdvisor 的数据，还有其他类似的 endpoint: `/metrics/resource & /metrics/probes` 

具体暴露出来的指标可以参考官方文档：
https://kubernetes.io/docs/concepts/cluster-administration/system-metrics/

# 业务指标

对于业务应用来说第一步也是需要将自己的指标暴露出去，如果是 Java 的话可以使用 Prometheus 提供的库：

```xml
<!-- The client -->  
<dependency>  
  <groupId>io.prometheus</groupId>  
  <artifactId>simpleclient</artifactId>  
  <version>0.16.0</version>  
</dependency>  
<!-- Hotspot JVM metrics-->  
<dependency>  
  <groupId>io.prometheus</groupId>  
  <artifactId>simpleclient_hotspot</artifactId>  
  <version>0.16.0</version>  
</dependency>
```
 它会自动将 JVM 相关的指标暴露出去，如果是在 VM 中的应用，那只需要简单的配置下 `static_configs` 就可以抓取指标了：
 
 ```yaml
 scrape_configs:  
- job_name: 'springboot'  
scrape_interval: 10s  
static_configs:  
- targets: ['localhost:8080'] # Spring Boot ip+port
```

但在 kubernetes 中这个 IP 是不固定的，每次重建应用的时候都会发生变化，所以我们需要一种服务发现机制来动态的找到 Pod 的 IP。

```yaml
- job_name: 'kubernetes-pods'
  kubernetes_sd_configs:
  - role: pod
  relabel_configs:
  - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_scrape]
    action: keep
    regex: true
  - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_path]
    action: replace
    target_label: __metrics_path__
    regex: (.+)
  - source_labels: [__address__, __meta_kubernetes_pod_annotation_prometheus_io_port]
    action: replace
    regex: ([^:]+)(?::\d+)?;(\d+)
    replacement: $1:$2
    target_label: __address__
  - action: labelmap
    regex: __meta_kubernetes_pod_label_(.+)
  - source_labels: [__meta_kubernetes_namespace]
    action: replace
    target_label: kubernetes_namespace
  - source_labels: [__meta_kubernetes_pod_label_component]
    action: replace
    target_label: job
  - source_labels: [__meta_kubernetes_pod_name]
    action: replace
    target_label: kubernetes_pod_name
```
Prometheus 提供了一个 `kubernetes_sd_configs` 的服务发现机制，他会在 kubernetes 中查找 Pod 中是否有配置以下的注解：

```YAML
template:
  metadata:
    annotations:
      prometheus.io/path: /metrics
      prometheus.io/port: "8082"
      prometheus.io/scrape: "true"
```

都配置成功后我们便可以在 Prometheus 的管理后台查看到具体的服务信息：
![image.png](https://s2.loli.net/2024/12/23/9tZ3uJTpvQY278D.png)
状态是 UP 则表明抓取数据成功，这样我们就可以在 Prometheus 中查询到数据了。

![image.png](https://s2.loli.net/2024/12/23/rM7nDiWgTUmA8h3.png)

Prometheus 除了支持 k8s 的服务发现之外还支持各种各样的服务发现，比如你已经使用了  Consul 或者是 Erueka 作为注册中心，也可以直接配置他们的地址然后进行服务发现，这样应用信息发生变化时 Prometheus 也能及时感知到。

当然 `docker/http/docker` 等都是支持的，可以按需选择。
## OpenTelemetry

随着这两年可观测性标准的完善，许多厂商都在往 `OpenTelemetry` 上进行迁移，接入 OpenTelemetry 与直接使用 Prometheus 最大的不同是：

> 不再由 Prometheus 主动抓取应用指标，而是由应用给 `OpenTelemetry-Collector` 推送标准化的可观测数据（包含日志、trace、指标），再由它远程写入 Prometheus 这类时序数据库中。

整体流程图如下：
![image.png](https://s2.loli.net/2024/07/22/oUPjd4KlX7niBaI.png)


对应用的最大的区别就是可以不再使用刚才提到 Prometheus 依赖，而是只需要挂载一个 javaagent 即可：

```shell
java -javaagent:opentelemetry-javaagent-2.4.0-SNAPSHOT.jar \  
-Dotel.traces.exporter=otlp \  
-Dotel.metrics.exporter=otlp \  
-Dotel.logs.exporter=none \  
-Dotel.service.name=java-demo \  
-Dotel.exporter.otlp.protocol=grpc \  
-Dotel.propagators=tracecontext,baggage \  
-Dotel.exporter.otlp.endpoint=http://127.0.0.1:5317 -jar target/demo-0.0.1-SNAPSHOT.jar
```

而其中会新增的一个 `OpenTelemetry-Collector`项目，由它将收到的指标数据转发给 Prometheus，所以在它的配置里会配置 Prometheus 的地址：

```yaml
exporters:
  otlphttp/prometheus:
    endpoint: http://prometheus:9292/api/v1/otlp
    tls:
      insecure: true
```


之前也写过两篇 `OpenTelemetry` 和监控相关的文章，可以一起阅读体验更佳：
- [从 Prometheus 到 OpenTelemetry：指标监控的演进与实践](https://crossoverjie.top/2024/06/13/ob/OpenTelemetry-metrics-concept/)
- [OpenTelemetry 实战：从零实现应用指标监控](https://crossoverjie.top/2024/08/27/ob/OpenTelemetry-02-metrics/)
# 总结


关于 Prometheus 的安装可以参考官方的 operator 或者是 helm：
https://github.com/prometheus-operator/kube-prometheus

当然如果不想使用 Prometheus 也推荐使用 [VictoriaMetrics](https://victoriametrics.com/)，是一个完全兼容 Prometheus 但是资源占用更少的时序数据库。

参考链接：
- https://kubernetes.io/docs/concepts/cluster-administration/system-metrics/
- https://github.com/google/cadvisor/blob/master/docs/storage/prometheus.md
- https://prometheus.io/docs/prometheus/latest/configuration/configuration/