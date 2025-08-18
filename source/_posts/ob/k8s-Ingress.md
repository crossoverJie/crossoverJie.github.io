---
title: k8s入门到实战-使用Ingress
date: 2023/09/15 17:13:37
categories: 
- k8s
tags: 
- Ingress
---

![ingress.png](https://s2.loli.net/2023/09/14/Pe7DWCIS2UMKHQ8.png)

# 背景

前两章中我们将应用[部署](https://crossoverjie.top/2023/08/31/ob/k8s-0-start/)到了 k8s 中，同时不同的服务之间也可以通过 [service](https://crossoverjie.top/2023/09/05/ob/k8s-service/) 进行调用，现在还有一个步骤就是将我们的应用暴露到公网，并提供域名的访问。

这一步类似于我们以前配置 Nginx 和绑定域名，提供这个能力的服务在 k8s 中称为 Ingress。

通过这个描述其实也能看出 Ingress 是偏运维的工作，但也不妨碍我们作为研发去了解这部分的内容；了解整个系统是如何运转的也是研发应该掌握的技能。
<!--more-->
# 安装 Ingress 控制器
在正式使用 Ingress 之前需要给 k8s 安装一个 Ingress 控制器，我们这里安装官方提供的 Ingress-nginx 控制器。

当然还有社区或者企业提供的各种控制器：
![image.png](https://s2.loli.net/2023/09/14/i1ebXQNUjxPkLEZ.png)


有两种安装方式: helm 或者是直接 apply 一个资源文件。

关于 `helm` 我们会在后面的章节单独讲解。

这里就直接使用资源文件安装即可，我已经上传到 GitHub 可以在这里访问：
[https://github.com/crossoverJie/k8s-combat/blob/main/deployment/ingress-nginx.yaml](https://github.com/crossoverJie/k8s-combat/blob/main/deployment/ingress-nginx.yaml)

其实这个文件也是直接从官方提供的复制过来的，也可以直接使用这个路径进行安装：
```yaml
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.8.2/deploy/static/provider/cloud/deploy.yaml
```

> yaml 文件的内容是一样的。

不过要注意安装之后可能容器状态一直处于 Pending 状态，查看容器的事件时会发现镜像拉取失败。

```shell
k describe pod ingress-nginx-controller-7cdfb9988c-lbcst -n ingress-nginx
```

> describe 是一个用于查看 k8s 对象详细信息的命令。

在刚才那份 yaml 文件中可以看到有几个镜像需要拉取，我们可以先在本地手动拉取镜像：
![image.png](https://s2.loli.net/2023/09/14/3IsRe2QWcmjTY41.png)
```shell
docker pull registry.k8s.io/ingress-nginx/controller:v1.8.2
```

如果依然无法拉取，可以尝试配置几个国内镜像源镜像拉取：

![image.png](https://s2.loli.net/2023/09/14/uTNDACSWdPp7BVt.png)

> 我这里使用的 docker-desktop 自带的 k8s，推荐读者朋友也使用这个工具。

# 创建 Ingress
使用刚才的 yaml 安装成功之后会在 `ingress-nginx` 命名空间下创建一个 Pod，通过 get 命令查看状态为 Running 即为安装成功。
```shell
$ k get pod -n ingress-nginx
NAME                            READY   STATUS    RESTARTS      AGE
ingress-nginx-controller-7cdf   1/1     Running   2 (35h ago)   3d
```

> Namespace 也是 k8s 内置的一个对象，可以简单理解为对资源进行分组管理，我们通常可以使用它来区分各个不同的环境，比如 dev/test/prod 等，不同命名空间下的资源不会互相干扰，且相互独立。


之后便可以创建 Ingress 资源了：
```yaml
apiVersion: networking.k8s.io/v1  
kind: Ingress  
metadata:  
  name: k8s-combat-ingress  
spec:  
  ingressClassName: nginx  
  rules:  
    - host: www.service1.io  
      http:  
        paths:  
          - backend:  
              service:  
                name: k8s-combat-service  
                port:  
                  number: 8081  
            path: /  
            pathType: Prefix  
    - host: www.service2.io  
      http:  
        paths:  
          - backend:  
              service:  
                name: k8s-combat-service-2  
                port:  
                  number: 8081  
            path: /  
            pathType: Prefix
```

看这个内容也很容易理解，创建了一个 `Ingress` 的对象，其中的重点就是这里的规则是如何定义的。

> 在 k8s 中今后还会接触到各种不同的 Kind

这里的 `ingressClassName: nginx`   也是在刚开始安装的控制器里定义的名字，由这个资源定义。

```yaml
apiVersion: networking.k8s.io/v1  
kind: IngressClass  
metadata:  
  labels:  
    app.kubernetes.io/component: controller  
    app.kubernetes.io/instance: ingress-nginx  
    app.kubernetes.io/name: ingress-nginx  
    app.kubernetes.io/part-of: ingress-nginx  
    app.kubernetes.io/version: 1.8.2  
  name: nginx
```

咱们这个规则很简单，就是将两个不同的域名路由到两个不同的 service。

> 这里为了方便测试又创建了一个 `k8s-combat-service-2` 的 service，和 `k8s-combat-service` 是一样的，只是改了个名字而已。

# 测试
也是为了方便测试，我在应用镜像中新增了一个接口，用于返回当前 Pod 的 hostname。
```go
http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {  
   name, _ := os.Hostname()  
   fmt.Fprint(w, name)  
})
```


由于我实际并没有 `www.service1.io/www.service2.io` 这两个域名，所以只能在本地配置 host 进行模拟。

```
10.0.0.37 www.service1.io
10.0.0.37 www.service2.io
```

> 我测试所使用的 k8s 部署在我家里一台限制的 Mac 上，所以这里的 IP 它的地址。


当我们反复请求两次这个接口，会拿到两个不同的 hostname，也就是将我们的请求轮训负载到了这两个 service 所代理的两个 Pod 中。

```shell
❯ curl http://www.service1.io/
k8s-combat-service-79c5579587-b6nlj%
❯ curl http://www.service1.io/
k8s-combat-service-79c5579587-bk7nw%
❯ curl http://www.service2.io/
k8s-combat-service-2-7bbf56b4d9-dkj9b%
❯ curl http://www.service2.io/
k8s-combat-service-2-7bbf56b4d9-t5l4g
```

我们也可以直接使用 describe 查看我们的 ingress 定义以及路由规则：
![image.png](https://s2.loli.net/2023/09/14/pgZzVb1L4aQTMwn.png)

```shell
$ k describe ingress k8s-combat-ingress
Name:             k8s-combat-ingress
Labels:           <none>
Namespace:        default
Address:          localhost
Ingress Class:    nginx
Default backend:  <default>
Rules:
  Host             Path  Backends
  ----             ----  --------
  www.service1.io
                   /   k8s-combat-service:8081 (10.1.0.65:8081,10.1.0.67:8081)
  www.service2.io
                   /   k8s-combat-service-2:8081 (10.1.0.63:8081,10.1.0.64:8081)
Annotations:       <none>
Events:            <none>
```

如果我们手动新增一个域名解析：
```shell
10.0.0.37 www.service3.io
❯ curl http://www.service3.io/
<html>
<head><title>404 Not Found</title></head>
<body>
<center><h1>404 Not Found</h1></center>
<hr><center>nginx</center>
</body>
</html>
```
会直接 404，这是因为没有找到这个域名的规则。

# 访问原理
![image.png](https://s2.loli.net/2023/09/14/9JTfp6GP24VmzAK.png)
整个的请求路径如上图所示，其实我们的 Ingress 本质上也是一个 service（所以它也可以启动多个副本来进行负载），只是他的类型是 `LoadBalancer`，通常这种类型的 service 会由云厂商绑定一个外部 IP，这样就可以通过这个外部 IP 访问 Ingress 了。

> 而我们应用的 service 是 ClusterIP，只能在应用内部访问

![image.png](https://s2.loli.net/2023/09/14/Bu67SlMLak1hirc.png)

通过 service 的信息也可以看到，我们 ingress 的 service 绑定的外部 IP 是 `localhost`（本地的原因）

# 总结
Ingress 通常是充当网关的作用，后续我们在使用 Istio 时，也可以使用 Istio 所提供的控制器来替换掉 Ingress-nginx，可以更方便的管理内外网流量。

本文的所有源码在这里可以访问：
[https://github.com/crossoverJie/k8s-combat](https://github.com/crossoverJie/k8s-combat)