---
title: Pulsar升级自动化：一键搞定集群升级与测试
date: 2024/08/06 11:15:50
categories:
  - OB
tags:
 - Pulsar
---


![](https://s2.loli.net/2024/07/01/xZSMlpJPWTRGkge.png)

# 背景
由于我在公司内部负责维护 `Pulsar`，需要时不时的升级 `Pulsar` 版本从而和社区保持一致。

而每次升级过程都需要做相同的步骤：

- 安装一个新版本的集群
- 触发功能性测试
- 触发性能测试
- 查看监控是否正常
	- 应用有无异常日志
	- 流量是否正常
	- 各个组件的内存占用是否正常
	- 写入延迟是否正常

<!--more-->

# 命令行工具

以上的流程步骤最好是全部一键完成，我们只需要人工检测下监控是否正常即可。

于是我便写了一个命令行工具，执行流程如下：
![](https://s2.loli.net/2024/07/01/cmXCqk6nyj2DpZA.png)
```shell
pulsar-upgrade-cli -h                                                                                                  ok | at 10:33:18 
A cli app for upgrading Pulsar

Usage:
  pulsar-upgrade-cli [command]

Available Commands:
  completion  Generate the autocompletion script for the specified shell
  help        Help about any command
  install     install a target version
  scale       scale statefulSet of the cluster

Flags:
      --burst-limit int                 client-side default throttling limit (default 100)
      --debug                           enable verbose output
  -h, --help                            help for pulsar-upgrade-cli
      --kube-apiserver string           the address and the port for the Kubernetes API server
      --kube-as-group stringArray       group to impersonate for the operation, this flag can be repeated to specify multiple groups.
      --kube-as-user string             username to impersonate for the operation
```

真实使用的 `example` 如下：

```shell
pulsar-upgrade-cli install \                                                   
        --values ./charts/pulsar/values.yaml \
        --set namespace=pulsar-test \
        --set initialize=true \
        --debug \
        --test-case-schema=http \
        --test-case-host=127.0.0.1 \
        --test-case-port=9999 \
    pulsar-test ./charts/pulsar -n pulsar-test
```

它的安装命令非常类似于 `helm`，也是直接使用 helm 的 `value.yaml` 进行安装；只是在安装成功后（等待所有的 Pod 都处于 Running 状态）会再触发 test-case 测试，也就是请求一个 endpoint。

> 这个 endpoint 会在内部处理所有的功能测试和性能测试，具体细节就在后文分析。

同时还提供了一个 scale（扩、缩容） 命令，可以用修改集群规模：

```shell
# 缩容集群规模为0
./pulsar-upgrade-cli scale --replicase 0 -n pulsar-test
# 缩容为最小集群
./pulsar-upgrade-cli scale --replicase 1 -n pulsar-test
# 恢复为最满集群
./pulsar-upgrade-cli scale --replicase 2 -n pulsar-test
```

这个需求是因为我们的 `Pulsar` 测试集群部署在了一个 `servless` 的 `kubernetes` 集群里，它是按照使用量收费的，所以在我不需要的使用的时候可以通过这个命令将所有的副本数量修改为 0，从而减少使用成本。

当只需要做简单的功能测试时便回将集群修改为最小集群，将副本数修改为只可以提供服务即可。

而当需要做性能测试时就需要将集群修改为最高配置。

这样可以避免每次都安装新集群，同时也可以有效的减少测试成本。
## 实现原理

```go
require (  
    github.com/spf13/cobra v1.6.1  
    github.com/spf13/pflag v1.0.5   
    helm.sh/helm/v3 v3.10.2
)
```
这个命令行工具本质上是参考了 helm 的命令行实现的，所有主要也是依赖了 `helm` 和 `cobra`。

![](https://s2.loli.net/2024/07/01/rouTSUBDIWciElx.png)
下面以最主要的安装命令为例，核心的是以下的步骤：

- 执行 `helm` 安装（这里是直接使用的 helm 的源码逻辑进行安装）
- 等待所有的 `Pod` 成功运行
- 触发 `test-case` 执行
- 等待测试用例执行完毕
- 检测是否需要卸载安装的集群

```go
func (e *installEvent) FinishInstall(cfg *action.Configuration, name string) error {  
    bar.Increment()  
    bar.Finish()  
  
    clientSet, err := cfg.KubernetesClientSet()  
    if err != nil {  
       return err  
    }  
    ctx := context.Background()  
    ip, err := GetServiceExternalIp(ctx, clientSet, settings.Namespace(), fmt.Sprintf("%s-proxy", name))  
    if err != nil {  
       return err  
    }  
  
    token, err := GetPulsarProxyToken(ctx, clientSet, settings.Namespace(), fmt.Sprintf("%s-token-proxy-admin", name))  
    if err != nil {  
       return err  
    }  
    // trigger testcase  
    err = e.client.Trigger(context.Background(), ip, token)  
    return err  
}
```

这里的 `FinishInstall` 需要获取到新安装的 Pulsar 集群的 proxy IP 地址和鉴权所使用的 `token`(`GetServiceExternalIp()`/`GetPulsarProxyToken()`)。

将这两个参数传递给 `test-case` 才可以构建出 `pulsar-client`.

这个命令的核心功能就是安装集群和触发测试，以及一些集群的基本运维能力。


# 测试框架

而关于这里的测试用例也有一些小伙伴咨询过，如何对 Pulsar 进行功能测试。

其实 Pulsar 源码中已经包含了几乎所有我们会使用到的测试代码，理论上只要新版本的官方镜像已经推送了那就是跑了所有的单测，质量是可以保证的。

那为什么还需要做功能测试呢？

其实很很简单，`Pulsar` 这类基础组件官方都有提供基准测试，但我们想要用于生产环境依然需要自己做压测得出一份属于自己环境下的性能测试报告；

根本目的是要看在自己的业务场景下是否可以满足（包括公司的软硬件，不同的业务代码）。

所以这里的功能测试代码有一个很重要的前提就是：**需要使用真实的业务代码进行测试**。

也就是业务在线上使用与 Pulsar 相关的代码需要参考功能测试里的代码实现，不然有些问题就无法在测试环节覆盖到。

> 这里我就踩过坑，因为在功能测试里用的是官方的 example 代码进行测试的，自然是没有问题；但业务在实际使用时，使用到了一个 Schema 的场景，并没有在功能测试里覆盖到（官方的测试用例里也没有😂），就导致升级到某个版本后业务功能无法正常使用（虽然用法确实是有问题），但应该在我测试阶段就暴露出来。

## 实现原理

![](https://s2.loli.net/2024/07/01/3vZiGABjkYh5LUJ.png)
以上是一个集群的功能测试报告，这里我只有 8 个测试场景（结合实际业务使用），考虑到未来可能会有新的测试用例，所以在设计这个测试框架时就得考虑到扩展性。


```java
AbstractJobDefine job5 =  
        new FailoverConsumerTest(event, "故障转移消费测试", pulsarClient, 20, admin);  
CompletableFuture<Void> c5 = CompletableFuture.runAsync(job5::start, EXECUTOR);  
AbstractJobDefine job6 = new SchemaTest(event,"schema测试",pulsarClient,20,prestoService);  
CompletableFuture<Void> c6 = CompletableFuture.runAsync(job6::start, EXECUTOR);  
AbstractJobDefine job7 = new VlogsTest(event,"vlogs test",pulsarClient,20, vlogsUrl);  
CompletableFuture<Void> c7 = CompletableFuture.runAsync(job7::start, EXECUTOR);  
  
CompletableFuture<Void> all = CompletableFuture.allOf(c1, c2, c3, c4, c5, c6, c7);  
all.whenComplete((___, __) -> {  
    event.finishAll();  
    pulsarClient.closeAsync();  
    admin.close();  
}).get();
```

对外提供的 trigger 接口就不贴代码了，重点就是在这里构建测试任务，然后等待他们全部执行完毕。

```java
@Data
public abstract class AbstractJobDefine {
    private Event event;
    private String jobName;
    private PulsarClient pulsarClient;

    private int timeout;

    private PulsarAdmin admin;

    public AbstractJobDefine(Event event, String jobName, PulsarClient pulsarClient, int timeout, PulsarAdmin admin) {
        this.event = event;
        this.jobName = jobName;
        this.pulsarClient = pulsarClient;
        this.timeout = timeout;
        this.admin = admin;
    }

    public void start() {
        event.addJob();
        try {
            CompletableFuture.runAsync(() -> {
                StopWatch watch = new StopWatch();
                try {
                    watch.start(jobName);
                    run(pulsarClient, admin);
                } catch (Exception e) {
                    event.oneException(this, e);
                } finally {
                    watch.stop();
                    event.finishOne(jobName, StrUtil.format("cost: {}s", watch.getTotalTimeSeconds()));
                }
            }, TestCase.EXECUTOR).get(timeout, TimeUnit.SECONDS);
        } catch (Exception e) {
            event.oneException(this, e);
        }
    }


    /** run busy code
     * @param pulsarClient pulsar client
     * @param admin pulsar admin client
     * @throws Exception e
     */
    public abstract void run(PulsarClient pulsarClient, PulsarAdmin admin) throws Exception;
}
```


核心代码就是这个抽象的任务定义类，其中的 start 函数用于定义任务执行的模版：
-  添加任务：具体实现是任务计数器+1
- 开始计时
- 执行抽血的 run 函数，具体实现交给子类
- 异常时记录事件
- 正常执行完毕后也记录事件


下面来看一个普通用例的实现情况：
![](https://s2.loli.net/2024/07/01/rdU5mPbfOJxv4TL.png)

就是重写了 `run()` 函数，然后在其中实现具体的测试用例，断言测试结果。

这样当我们需要再添加用例的时候只需要再新增一个子类实现即可。

同时还需要定义一个事件接口，用于处理一些关键的节点：

```java
public interface Event {  
  
    /**  
     * 新增一个任务  
     */  
    void addJob();  
  
    /** 获取运行中的任务数量  
     * @return 获取运行中的任务数量  
     */  
    TestCaseRuntimeResponse getRuntime();  
  
    /**  
     * 单个任务执行完毕  
     *  
     * @param jobName    任务名称  
     * @param finishCost 任务完成耗时  
     */  
    void finishOne(String jobName, String finishCost);  
  
    /**单个任务执行异常  
     * @param jobDefine 任务  
     * @param e 异常  
     */  
    void oneException(AbstractJobDefine jobDefine, Exception e);  
  
    /**  
     * 所有任务执行完毕  
     */  
    void finishAll();  
}
```

其中 `getRuntime` 接口是用于在 cli 那边查询任务是否执行完毕的接口，只有任务执行完毕之后才能退出 `cli`。


# 监控指标

当这些任务运行完毕后我们需要重点查看应用客户端和 Pulsar broker 端是否有异常日志。

同时还需要观察一些关键的监控面板：

![](https://s2.loli.net/2024/07/01/sGxOjRWnScPl5oZ.png)
![](https://s2.loli.net/2024/07/01/E6hcSxHrRmNVFoi.png)
![](https://s2.loli.net/2024/07/01/UeFZ73yRbpkAsEH.png)


包含但不限于：
- 消息吞吐量
- `broker` 写入延迟
- `Bookkeeper` 的写入、读取成功率，以及延迟。

当然还有 `zookeeper` 的运行情况也需要监控，限于篇幅就不一一粘贴了。

以上就是测试整个 Pulsar 集群的流程，当然还有一些需要优化的地方。

比如使用命令行还是有些不便，后续可能会切换到网页上就可以操作。