---
title: k8s入门到实战-应用配置
date: 2023/09/26 14:20:33
categories:
  - k8s
tags:
  - ConfigMap
---
![ConfigMap.png](https://s2.loli.net/2023/09/26/b9N2AufHMpqWRKs.png)


# 背景

在前面[三节中](https://crossoverjie.top/categories/k8s/)已经讲到如何将我们的应用部署到 k8s 集群并提供对外访问的能力，x现在可以满足基本的应用开发需求了。

现在我们需要更进一步，使用 k8s 提供的一些其他对象来标准化我的应用开发。
首先就是 `ConfigMap`，从它的名字也可以看出这是用于管理配置的对象。
<!--more-->
# ConfigMap

不管我们之前是做 `Java`、`Go` 还是 `Python` 开发都会使用到配置文件，而 `ConfigMap` 的作用可以将我们原本写在配置文件里的内容转存到 `k8s` 中，然后和我们的 `Container` 进行绑定。

## 存储到环境变量
绑定的第一种方式就是将配置直接写入到环境变量，这里我先定义一个 `ConfigMap`：
```yaml
apiVersion: v1  
kind: ConfigMap  
metadata:  
  name: k8s-combat-configmap  
data:  
  PG_URL: "postgres://postgres:postgres@localhost:5432/postgres?sslmode=disable"
```

重点是 `data` 部分，存储的是一个 `KV` 结构的数据，这里存储的是一个数据库连接。
> 需要注意，KV 的大小不能超过 1MB

接着可以在容器定义中绑定这个 `ConfigMap` 的所有 `KV` 到容器的环境变量：
```yaml
# Define all the ConfigMap's data as container environment variables 
envFrom:  
  - configMapRef:  
      name: k8s-combat-configmap
```

我将 `ConfigMap` 的定义也放在了同一个 [deployment](https://github.com/crossoverJie/k8s-combat/blob/main/deployment/deployment.yaml) 中，直接 apply:
```shell
❯ k apply -f deployment/deployment.yaml
deployment.apps/k8s-combat created
configmap/k8s-combat-configmap created
```

此时 `ConfigMap` 也会被创建，我们可以使用
```shell
❯ k get configmap
NAME                   DATA   AGE
k8s-combat-configmap   1      3m17s

❯ k describe configmap k8s-combat-configmap
Data
====
PG_URL:
----
postgres://postgres:postgres@localhost:5432/postgres?sslmode=disable
```
拿到刚才声明的配置信息。

----
同时我在代码中也读取了这个环境变量：

```go
http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {  
   name, _ := os.Hostname()  
   url := os.Getenv("PG_URL")   
   fmt.Fprint(w, fmt.Sprintf("%s-%s", name, url))  
})
```

访问这个接口便能拿到这个环境变量：
```shell
root@k8s-combat-7b987bb496-pqt9s:/# curl http://127.0.0.1:8081
k8s-combat-7b987bb496-pqt9s-postgres://postgres:postgres@localhost:5432/postgres?sslmode=disable

root@k8s-combat-7b987bb496-pqt9s:/# echo $PG_URL
postgres://postgres:postgres@localhost:5432/postgres?sslmode=disable
```

## 存储到文件
有些时候我们也需要将这些配置存储到一个文件中，比如在 Java 中可以使用 `spring` 读取，`Go` 也可以使用 `configor` 这些第三方库来读取，所有配置都在一个文件中也更方便维护。

![image.png](https://s2.loli.net/2023/09/26/g2IhktH7iwWb8LT.png)
在 `ConfigMap` 中新增了一个 `key:APP` 存放了一个 `yaml` 格式的数据，然后在容器中使用 `volumes` 和 `volumeMounts` 将数据挂载到容器中的指定路径`/go/bin/app.yaml`

apply 之后我们可以在容器中查看这个文件是否存在：
```shell
root@k8s-combat-7b987bb496-pqt9s:/# cat /go/bin/app.yaml
name: k8s-combat
pulsar:
  url: "pulsar://localhost:6650"
  token: "abc"
```
配置已经成功挂载到了这个路径，我们便可以在代码中读取这些数据。

# Secret
可以看到 `ConfigMap` 中是明文存储数据的；
```shell
k describe configmap k8s-combat-configmap
```
可以直接查看。

对一些敏感数据就不够用了，这时我们可以使用 `Secret`:
```yaml
apiVersion: v1  
kind: Secret  
metadata:  
  name: k8s-combat-secret  
type: Opaque  
data:  
  PWD: YWJjCg==

---
env:  
  - name: PG_PWD  
    valueFrom:  
      secretKeyRef:  
        name: k8s-combat-secret  
        key: PWD
```

这里我新增了一个 `Secret` 用于存储密码，并在 `container` 中也将这个 `key` 写入到环境变量中。

```shell
❯ echo 'abc' | base64
YWJjCg==
```
`Secret` 中的数据需要使用 `base64` 进行编码，所以我这里存储的是 abc.

apply 之后我们再查看这个 `Secret` 是不能直接查看原始数据的。
```shell
❯ k describe secret k8s-combat-secret
Name:         k8s-combat-secret
Type:  Opaque

Data
====
PWD:  4 bytes
```

`Secret` 相比 `ConfigMap` 多了一个 `Type` 选项。
![](https://s2.loli.net/2023/09/26/G25TRcSzCbIVDQ3.png)

我们现阶段在应用中用的最多的就是这里的 `Opaque`，其他的暂时还用不上。


# 总结


在实际开发过程中研发人员基本上是不会直接接触 `ConfigMap`，一般会给开发者在管理台提供维护配置的页面进行 CRUD。

由于 `ConfigMap` 依赖于 k8s 与我们应用的语言无关，所以一些高级特性，比如实时更新就无法实现，每次修改后都得重启应用才能生效。

类似于 Java 中常见的配置中心：`Apollo,Nacos` 使用上会有不小的区别，但这些是应用语言强绑定的，如果业务对这些配置中心特性有强烈需求的话也是可以使用的。

但如果团队本身就是多语言研发，想要降低运维复杂度 `ConfigMap` 还是不二的选择。

下一章节会更新大家都很感兴趣的服务网格 `Istio`，感兴趣的朋友多多点赞转发🙏🏻。

本文的所有源码和资源文件在这里可以访问：
[https://github.com/crossoverJie/k8s-combat](https://github.com/crossoverJie/k8s-combat)