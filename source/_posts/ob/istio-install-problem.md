---
title: Istio 安装过程中遇到的坑
date: 2024/12/25 13:48:35
categories:
  - Istio
  - k8s
tags:
- Istio
---

# 安装 Istio
最近这段时间一直在做服务网格（Istio）相关的工作，背景是我们准备自建 Istio，首先第一件事情就是要安装。

我这里直接使用官网推荐的 [istioctl](https://istio.io/v1.18/docs/setup/install/istioctl) 进行安装：

```bash
$ cat <<EOF > ./my-config.yaml
apiVersion: install.istio.io/v1alpha1  
kind: IstioOperator  
metadata:  
  namespace: istio-1-18-5  
spec:  
  profile: minimal  
  revision: istio-1-18-5  
  meshConfig:  
    accessLogFile: /dev/stdout
EOF
$ istioctl install -f my-config.yaml -n istio-1-18-5
```

这里我使用的 profile 是 minimal，它只会安装核心的控制面，具体差异见下图：
![image.png](https://s2.loli.net/2024/12/25/KBu5w4WjLU9zTH3.png)
<!--more-->

输出以下内容时代表安装成功：

```bash
This will install the Istio 1.18.5 minimal profile with ["Istio core" "Istiod"] components into the cluster. Proceed? (y/N) y
✔ Istio core installed                                                                                                                                   
✔ Istiod installed                                                                         
✔ Installation complete  
```

之后我们便可以在指定的 `namespace` 下查询到控制面的 Pod：

```bash
k get pod -n istio-1-18-5
NAME                                   READY   STATUS    RESTARTS   AGE
istiod-istio-1-18-5-6cb9898585-64jtg   1/1     Running   0          22h
```

然后只需要将需要注入 sidecar 的 namespace 中开启相关的配置即可，比如我这里将 test 这个 namespace 开启 sidecar 注入：

```yaml
apiVersion: v1
kind: Namespace
metadata:
  labels:
    istio.io/rev: istio-1-18-5
    kubernetes.io/metadata.name: test
```

最主要的就是加上 `istio.io/rev: istio-1-18-5` 的标签，标签的值就是我们在安装 istio 时指定的值：`revision: istio-1-18-5`。

此时只要我们在这个 namespace 下部署一个 Pod 就会为这个 Pod 挂载一个 sidecar。

![image.png](https://s2.loli.net/2024/12/25/Jdrx47cosVtqBv3.png)

# 更新配置的坑
![image.png](https://s2.loli.net/2024/12/25/WJjBgqIxCMN1Tz3.png)
![image.png](https://s2.loli.net/2024/12/25/n4bQDHys9hMoR6c.png)

[默认情况](https://istio.io/latest/docs/ops/integrations/prometheus/#option-1-metrics-merging)下 Istio 会将应用 Pod 的暴露出来的 metrics 和 sidecar 的指标合并在一起，然后暴露为 `:15020/stats/prometheus` 这个 endpoint。

而我们自己在 Pod 上定义的注解则是被覆盖掉了：
![image.png](https://s2.loli.net/2024/12/25/vCpUEJgnTYI5rje.png)

但我们是将应用和 sidecar 的指标分开采集的，所以我们不需要这个自动合并。

![](https://s2.loli.net/2024/12/25/5bQ71OYxmkBFXh6.png)
> 会单独配置 15090 端口的采集任务


所以我需要将这个功能关闭，安装文档的说明只需要在控制面中将 `enablePrometheusMerge` 修改为 false 即可。

安装好 Istio 控制面之后会创建一个 IstioOperator 的 CRD 资源：

```shell
k get IstioOperator -A
NAMESPACE      NAME                           REVISION       STATUS   AGE
istio-1-18-5   installed-state-istio-1-18-5   istio-1-18-5            27h
```

所有控制面的配置都可以在这里面修改，所以我想当然的在这里加入了 `enablePrometheusMerge: false` 的配置。

![image.png](https://s2.loli.net/2024/12/25/bCdUxLRQDFEOI6j.png)

加上之后我重启了 Pod 发现依然还是 Istio 的注解：

![image.png](https://s2.loli.net/2024/12/25/n4bQDHys9hMoR6c.png)

也就是说这个配置并没有生效，即便是我把控制面也重启了也没有效果。

按照原理来说，这些配置应该是控制面下发给数据面的，大胆猜测下也就是控制面没有拿到最新的配置。

但是我卸载控制面，再安装的时候就指定这个配置确是生效的，也就是说配置没问题，只是我在安装完成后再修改就没法同步。

之后我在 [stackoverflow](https://stackoverflow.com/questions/70076326/how-to-update-istio-configuration-after-installation) 上找到了类似的问题：
![image.png](https://s2.loli.net/2024/12/25/SybMZeG6fc1pjhd.png)

简单来说安装好 istio 之后我们也可以继续使用 `istioctl install -f xx.yaml` 进行更新。



# 原理

后来我仔细看了下 istioctl 这个命令的 help 文档，发现其实已经在描述里写清楚了：
![image.png](https://s2.loli.net/2024/12/26/rv9nkiIO6wgbj5s.png)
甚至还有个别名就叫 `apply` 这就和 `kubectl apply` 的命令非常类似了，也更容易理解了，任何的修改只需要 `apply` 执行一次就可以了。

不过我也在好奇，既然创建的是一个 `IstioOperator` 的 CRD，理论上是需要一个 Operator 来读取这里的数据然后再创建一个控制面，同步配置之类的操作。

但当我安装好 Istio 之后并没看到有一个 Operator 的 Pod 在运行，所以就比较好奇 `install` 这个命令是如何实现配置同步的。

经过对 `istioctl` 的 debug 找到了具体的原因：

![WeChatWorkScreenshot_bab3706b-2815-46a6-961e-408439b81841.png](https://s2.loli.net/2024/12/26/2bWSIDsf5gXdkHt.png)
![WeChatWorkScreenshot_8f421734-f1e7-4a07-a676-84300187485d.png](https://s2.loli.net/2024/12/26/XNtGeqnvZiEomfc.png)

在 `istioctl install -f xx.yaml` 执行之后会直接解析 `xx.yaml` 里的 `IstioOperator` 生成所有的 `manifest` 资源，在这个过程中也会生成一个 `ConfigMap`，所有的配置都是存放在其中的。

所以其实我手动修改这个 `ConfigMap` 也可以动态更新控制面的配置，之前我只是修改了 CRD，我以为还有一个 Operator 来监听这里的变化然后同步数据；实际上并不存在这个逻辑，而是直接应用的 `manifest`。

参考链接：
- https://istio.io/v1.18/docs/setup/install/istioctl
- https://istio.io/latest/docs/ops/integrations/prometheus/#option-1-metrics-merging
- https://stackoverflow.com/questions/70076326/how-to-update-istio-configuration-after-installation