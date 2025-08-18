---
title: 【译】几个你或许并不知道 kubernetes 技巧
date: 2024/06/03 18:05:25
categories:
  - 翻译
  - kubernetes
tags:
  - kubernetes
---

![](https://s2.loli.net/2024/06/03/AoNyHhS4sl96tFx.png)


原文链接: https://overcast.blog/13-kubernetes-tricks-you-didnt-know-647de6364472

# 使用 PreStop 优雅关闭 Pod

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: graceful-shutdown-example
spec:
  containers:
  - name: sample-container
    image: nginx
    lifecycle:
      preStop:
        exec:
          command: ["/bin/sh", "-c", "sleep 30 && nginx -s quit"]
```

PreStop 允许 Pod 在终止前执行一个命令或者是脚本，使用它就可以在应用退出前释放一些资源，确保应用可以优雅退出。

比如可以在 Nginx 的 Pod 退出前将当前的请求执行完毕。

<!--more-->

# 使用临时容器调试 Pod
临时容器可以不修改一个运行的容器的前提下调试容器，可以很方便的调试一些生产环境的 bug，可以避免重启应用。

```bash
kubectl alpha debug -it podname --image=busybox --target=containername
```

生产环境谨慎使用，只有在当前环境下无法排查问题的时候才使用。

# 基于自定义的  Metrics 自动扩容Pod

kubernetes 是提供了 HPA 机制可以跟进 CPU 内存等标准数据进行自动扩缩容，但有时我们需要根据自定义的数据进行扩缩容。

比如某个接口的延迟、队列大小等。

```yaml
apiVersion: autoscaling/v2beta2
kind: HorizontalPodAutoscaler
metadata:
  name: custom-metric-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: your-application
  minReplicas: 1
  maxReplicas: 10
  metrics:
  - type: Pods
    pods:
      metric:
        name: your_custom_metric
      target:
        type: AverageValue
        averageValue: 10
```

# 用 Init Containers 配置启动脚本

初始化容器可以在应用容器启动前运行，我们可以使用它来初始化应用需要的配置、等待依赖的服务启动完成等工作：

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: myapp-pod
spec:
  containers:
  - name: myapp-container
    image: myapp
  initContainers:
  - name: init-myservice
    image: busybox
    command: ['sh', '-c', 'until nslookup myservice; do echo waiting for myservice; sleep 2; done;']
```

比如这个初始化容器会等待 myservice 可用后才会启动应用。

需要注意的是如果初始化容器会阻塞应用启动，所以要避免在初始化容器里执行耗时操作。

# Node 亲和性调度
当我们需要将某些应用部署到硬件配置较高的节点时（比如需要 SSD 硬盘），就可以使用节点亲和性来部署应用：

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: with-node-affinity
spec:
  containers:
  - name: with-node-affinity
    image: nginx
  affinity:
    nodeAffinity:
      requiredDuringSchedulingIgnoredDuringExecution:
        nodeSelectorTerms:
        - matchExpressions:
          - key: disktype
            operator: In
            values:
            - ssd
```

这个 Pod 会被部署到有这个 `disktype=ssd` 标签的 节点上。

# 动态配置：ConfigMap 和 Secrets
ConfigMap 和 Secrets可以动态注入到 Pod 中，避免对这些配置硬编码。

ConfigMap 适合非敏感的数据，Secrets 适合敏感的数据。

```yaml
# ConfigMap Example
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
data:
  config.json: |
    {
      "key": "value",
      "databaseURL": "http://mydatabase.example.com"
    }

# Pod Spec using ConfigMap
apiVersion: v1
kind: Pod
metadata:
  name: myapp-pod
spec:
  containers:
    - name: myapp-container
      image: myapp
      volumeMounts:
      - name: config-volume
        mountPath: /etc/config
  volumes:
    - name: config-volume
      configMap:
        name: app-config
```

这样在应用中就可以通过这路径 `/etc/config/config.json` 读取数据了。

> 当然也可以把这些数据写入到环境变量中。


以上这些个人技巧用的最多的是：
- 临时容器调试 Pod，特别是业务容器缺少一些命令时。
- Init Container 等待依赖的服务启动完成。
- Node 亲和性调度。
- ConfigMap 是基础操作了。