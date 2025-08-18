---
title: 实战：如何优雅的从 Skywalking 切换到 OpenTelemetry
date: 2024/04/07 17:16:21
categories:
  - OB
tags:
- k8s
---

![](https://s2.loli.net/2024/03/04/8YFIh7suTirZacj.png)

# 背景

最近公司将我们之前使用的链路工具切换为了 `OpenTelemetry`.

![](https://s2.loli.net/2024/03/03/9V1aUnpOd8EAG2Y.png)

<!--more-->
我们的技术栈是：

```
        OTLP                               
Client──────────►Collect────────►StartRocks
(Agent)                               ▲    
                                      │    
                                      │    
                                   Jaeger                                       
```

其中客户端使用 OpenTelemetry 提供的 Java Agent 进行埋点收集数据，再由 Agent 通过 OTLP(OpenTelemetry Protocol) 协议将数据发往 Collector，在 `Collector` 中我们可以自行任意处理数据，并决定将这些数据如何存储（这点在以往的 SkyWalking 体系中是很难自定义的）

这里我们将数据写入 StartRocks 中，供之后的 UI 层进行查看。

> `OpenTelemetry` 是可观测系统的新标准，基于它可以兼容以前使用的 Prometheus、 victoriametrics、skywalking 等系统，同时还可以灵活扩展，不用与任何但一生态或技术栈进行绑定。 
> 更多关于 OTel 的内容会在今后介绍。


## 难点
其中有一个关键问题就是：如何在线上进行**无缝切换**。

虽然我们内部的发布系统已经支持重新发布后就会切换到新的链路，也可以让业务自行发布然后逐步的切换到新的系统，这样也是最保险的方式。

但这样会有几个问题：
- 当存在调用依赖的系统没有全部切换为新链路时，再查询的时候就会出现断层，整个链路无法全部串联起来。
- 业务团队没有足够的动力去推动发布，可能切换的周期较长。

所以最好的方式还是由我们在后台统一发布，对外没有任何感知就可以一键全部切换为 OpenTelemetry。

仔细一看貌似也没什么难的，无非就是模拟用户点击发布按钮而已。

但这事由我们自动来做就不一样了，用户点击发布的时候会选择他们认为可以发布的分支进行发布，我们不能自作主张的比如选择 main 分支，有可能只是合并了但还不具备发布条件。

所以保险的方式还是得用当前项目上一次发布时所使用的 git hash 值重新打包发布。

但这也有几个问题：
- 重复打包发布太慢了，线上几十上百个项目，每打包发布一次就得几分钟，虽然可以并发，但考虑到 kubernetes 的压力也不能调的太高。
- 保不准业务镜像中有单独加入一些环境变量，这样打包可能会漏。


# 切换方案

所以思来想去最保险的方法还是将业务镜像拉取下来，然后手动删除镜像中的 skywalking 包以及 JVM 参数，全部替换为 OpenTelemetry 的包和 JVM 参数。

整体的方案如下：
1. 遍历 namespace 的 `pod ＞0` 的 deployment
2. 遍历 deployment 中的所有 container，获得业务镜像
	1. 跳过 istio 和日志采集 container，获取到业务容器
	2. 判断该容器是否需要替换，其实就是判断环境变量中是否有 skywalking ，如果有就需要替换。
	3. 获取业务容器的镜像
3. 基于该 Image 重新构建一个 OpenTelemetry 的镜像
	  3.1 新的镜像包含新的启动脚本.
		  3.1.1 新的启动脚本中会删除原有的 skywalking agent
	  3.2 新镜像会包含 OpenTelemetry 的 jar 包以及我们自定义的 OTel 扩展包
	  3.3 替换启动命令为新的启动脚本
4. 修改 deployment 中的 JVM 启动参数
5. 修改 deployment 的镜像后滚动更新
6. 开启一个 goroutine 定时检测更新之后是否启动成功
	1. 如果长时间 (比如五分钟) 都没有启动成功，则执行回滚流程

# 具体代码

因为需要涉及到操作 kubernetes，所以整体就使用 Golang 实现了。

## 遍历 deployment 得到需要替换的容器镜像

```go
func ProcessDeployment(ctx context.Context, finish []string, deployment v1.Deployment, clientSet kubernetes.Interface) error {
	deploymentName := deployment.Name
	for _, s := range finish {
		if s == deploymentName {
			klog.Infof("Skip finish deployment:%s", deploymentName)
			return nil
		}
	}
	// Write finish deployment name to a file
	defer writeDeploymentName2File(deploymentName, fmt.Sprintf("finish-%s.log", deployment.Namespace))

	appName := deployment.GetObjectMeta().GetLabels()["appName"]
	klog.Infof("Begin to process deployment:%s, appName:%s", deploymentName, appName)

	upgrade, err := checkContainIstio(ctx, deployment, clientSet)
	if err != nil {
		return err
	}
	if upgrade == false {
		klog.Infof("Don't have istio, No need to upgrade deployment:%s appName:%s", deploymentName, appName)
		return nil
	}

	for i, container := range deployment.Spec.Template.Spec.Containers {
		if strings.HasPrefix(deploymentName, container.Name) {

			// Check if container has sw jvm
			for _, envVar := range container.Env {
				if envVar.Name == "CATALINA_OPTS" {
					if !strings.Contains(envVar.Value, "skywalking") {
						klog.Infof("Skip upgrade don't have sw jvm deployment:%s container:%s", deploymentName, container.Name)
						return nil
					}
				}
			}
			upgrade(container)

			// Check newDeployment status
			go checkNewDeploymentStatus(ctx, clientSet, newDeployment)

			// delete from image
			deleteImage(container.Image)

		}
	}

	return nil
}
```

这个函数需要传入一个 deployment ，同时还有一个已经完成了的列表进来。

> 已完成列表用于多次运行的时候可以快速跳过已经执行的 deployment。

`checkContainIstio()` 函数很简单，判断是否包含了 Istio 容器，如果没有包含说明不是后端应用（可能是前端、大数据之类的任务），就可以直接跳过了。

---
![](https://s2.loli.net/2024/03/03/xzHPV9mgCJkZ4cY.png)
而判断是否需要替换的前提这事判断环境变量 `CATALINA_OPTS` 中是否包含了 skywalking 的内容，如果包含则说明需要进行替换。


##  Upgrade 核心函数

```go
func upgrade(container Container){
	klog.Infof("Begin to upgrade deployment:%s container:%s", deploymentName, container.Name)
	newImageName := fmt.Sprintf("%s-otel-%s", container.Image, generateRandomString(4))
	err := BuildNewOtelImage(container.Image, newImageName)
	if err != nil {
		return err
	}

	// Update deployment jvm ENV
	for e, envVar := range container.Env {
		if envVar.Name == "CATALINA_OPTS" {
			otelJVM := replaceSWAgent2OTel(envVar.Value, appName)
			deployment.Spec.Template.Spec.Containers[i].Env[e].Value = otelJVM
		}
	}
	// Update deployment image
	deployment.Spec.Template.Spec.Containers[i].Image = newImageName

	newDeployment, err := clientSet.AppsV1().Deployments(deployment.Namespace).Update(ctx, &deployment, metav1.UpdateOptions{})
	if err != nil {
		return err
	}
	klog.Infof("Finish upgrade deployment:%s container:%s", deploymentName, container.Name)
}
```

这里一共分为以下几部：
- 基于老镜像构建新镜像
- 更新原有的 `CATALINA_OPTS` 环境变量，也就是替换 skywalking 的参数
- 更新 deployment 镜像，触发滚动更新

## 构建新镜像

```go
	dockerfile = fmt.Sprintf(`FROM %s
COPY %s /home/admin/%s
COPY otel.tar.gz /home/admin/otel.tar.gz
RUN tar -zxvf /home/admin/otel.tar.gz -C /home/admin
RUN rm -rf /home/admin/skywalking-agent
ENTRYPOINT ["/bin/sh", "/home/admin/start.sh"]
`, fromImage, script, script)

	idx := strings.LastIndex(newImageName, "/") + 1
	dockerFileName := newImageName[idx:]
	create, err := os.Create(fmt.Sprintf("Dockerfile-%s", dockerFileName))
	if err != nil {
		return err
	}
	defer func() {
		create.Close()
		os.Remove(create.Name())
	}()
	_, err = create.WriteString(dockerfile)
	if err != nil {
		return err
	}

	cmd := exec.Command("docker", "build", ".", "-f", create.Name(), "-t", newImageName)
	cmd.Stdin = strings.NewReader(dockerfile)
	if err := cmd.Run(); err != nil {
		return err
	}
```

其实这里的重点就是构建这个新镜像，从这个 dockerfile 中也能看出具体的逻辑，也就是上文提到的删除原有的 skywalking 资源同时将新的 OpenTelemetry 资源打包进去。

最后再将这个镜像上传到私服。


![](https://s2.loli.net/2024/03/03/s7fryhQSPJgcuvj.png)
其中的替换 JVM 参数也比较简单，直接删除 skywalking 的内容，然后再追加上 OpenTelemetry 需要的参数即可。


## 定时检测替换是否成功

```go
func checkNewDeploymentStatus(ctx context.Context, clientSet kubernetes.Interface, newDeployment *v1.Deployment) error {
	ready := true
	tick := time.Tick(10 * time.Second)
	for i := 0; i < 30; i++ {
		<-tick
		originPodList, err := clientSet.CoreV1().Pods(newDeployment.Namespace).List(ctx, metav1.ListOptions{
			LabelSelector: metav1.FormatLabelSelector(&metav1.LabelSelector{
				MatchLabels: newDeployment.Spec.Selector.MatchLabels,
			}),
		})
		if err != nil {
			return err
		}

		// Check if there are any Pods
		if len(originPodList.Items) == 0 {
			klog.Infof("No Pod in deployment:%s, Skip", newDeployment.Name)
		}
		for _, item := range originPodList.Items {
			// Check Pod running
			for _, status := range item.Status.ContainerStatuses {
				if status.RestartCount > 0 {
					ready = false
					break
				}
			}
		}
		klog.Infof("Check deployment:%s namespace:%s status:%t", newDeployment.Name, newDeployment.Namespace, ready)
		if ready == false {
			break
		}
	}

	if ready == false {
		// rollback
		klog.Infof("=======Rollback deployment:%s namespace:%s", newDeployment.Name, newDeployment.Namespace)
		writeDeploymentName2File(newDeployment.Name, fmt.Sprintf("rollback-%s.log", newDeployment.Namespace))
	}

	return nil
}
```

这里会启动一个 10s 执行一次的定时任务，每次都会检测是否有容器发生了重启（正常情况下是不会出现重启的）

如果检测了 30 次都没有重启的容器，那就说明本次替换成功了，不然就记录一个日志文件，然后人工处理。

> 这种通常是原有的镜像与 OpenTelemetry 不兼容，比如里面写死了一些 skywalking 的 API，导致启动失败。


所以替换任务跑完之后我还会检测这个 `rollback-$namespace` 的日志文件，人工处理这些失败的应用。

## 分批处理 deployment


最后讲讲如何单个调用刚才的 `ProcessDeployment()` 函数。

考虑到不能对 kubernetes 产生影响，所以我们需要限制并发处理 deployment 的数量（我这里的限制是 10 个）。

所以就得分批进行替换，每次替换 10 个，而且其中有一个执行失败就得暂停后续任务，由人工检测失败原因再决定是否继续处理。

> 毕竟处理的是线上应用，需要小心谨慎。

所以触发的代码如下：

```go
func ProcessDeploymentList(ctx context.Context, data []v1.Deployment, clientSet kubernetes.Interface) error {
	file, err := os.ReadFile(fmt.Sprintf("finish-%s.log", data[0].Namespace))
	if err != nil {
		return err
	}
	split := strings.Split(string(file), "\n")

	batchSize := 10
	start := 0

	for start < len(data) {

		end := start + batchSize
		if end > len(data) {
			end = len(data)
		}

		batch := data[start:end]

		//等待goroutine结束
		var wg sync.WaitGroup
		klog.Infof("Start process batch size %d", len(batch))

		errs := make(chan error, len(batch))

		wg.Add(len(batch))
		for _, item := range batch {
			d := item
			go func() {
				defer wg.Done()
				if err := ProcessDeployment(ctx, split, d, clientSet); err != nil {
					klog.Errorf("!!!Process deployment name:%s error: %v", d.Name, err)
					errs <- err
					return
				}
			}()
		}

		go func() {
			wg.Wait()
			close(errs)
		}()

		//任何一个失败就返回
		for err := range errs {
			if err != nil {
				return err
			}
		}

		start = end
		klog.Infof("Deal next batch")
	}

	return nil

}
```

使用 `WaitGroup` 来控制一组任务，使用一个 chan 来传递异常；这类分批处理的代码在一些批处理框架中还蛮常见的。


# 总结
最后只需要查询某个 namespace 下的所有 deployment 列表传入这个批处理函数即可。

不过整个过程中还是有几个点需要注意：
- 因为需要替换镜像的前提是要把现有的镜像拉取到本地，所以跑这个任务的客户端需要有充足的磁盘，同时和镜像服务器的网络条件较好。
- 不然执行的过程会比较慢，同时磁盘占用满了也会影响任务。

其实这个功能依然有提升空间，考虑到后续会升级 OpenTelemetry  agent 的版本，甚至也需要增减一些 JVM 参数。

所以最后有一个统一的工具，可以直接升级 Agent，而不是每次我都需要修改这里的代码。

![](https://s2.loli.net/2024/03/03/lLIqQtmD2AdfGyv.png)

后来在网上看到了得物的相关分享，他们可以远程加载配置来解决这个问题。

这也是一种解决方案，直到我们看到了 OpenTelemetry 社区提供了 [Operator](https://github.com/open-telemetry/opentelemetry-operator/#opentelemetry-auto-instrumentation-injection)，其中也包含了注入 agent 的功能。


```yaml
apiVersion: opentelemetry.io/v1alpha1  
kind: Instrumentation  
metadata:  
  name: my-instrumentation  
spec:  
  exporter:  
    endpoint: http://otel-collector:4317  
  propagators:  
    - tracecontext  
    - baggage  
    - b3  
  sampler:  
    type: parentbased_traceidratio  
    argument: "0.25"  
  java:  
    image: private/autoinstrumentation-java:1.32.0-1
```

我们可以使用他提供的 CRD 来配置我们 agent，只要维护好自己的镜像就好了。

使用起来也很简单，只要安装好了 OpenTelemetry-operator ，然后再需要注入 Java Agent 的 Pod 中使用注解：

```yaml
instrumentation.opentelemetry.io/inject-java: "true"
```
 operator 就会自动从刚才我们配置的镜像中读取 agent，然后复制到我们的业务容器。

再配置上环境变量 `$JAVA_TOOL_OPTIONS=/otel/javaagent.java`, 这是一个 Java 内置的环境变量，应用启动的时候会自动识别，这样就可以自动注入 agent 了。

```go
envJavaToolsOptions   = "JAVA_TOOL_OPTIONS"

// set env value
idx := getIndexOfEnv(container.Env, envJavaToolsOptions)  
if idx == -1 {  
    container.Env = append(container.Env, corev1.EnvVar{  
       Name:  envJavaToolsOptions,  
       Value: javaJVMArgument,  
    })} else {  
    container.Env[idx].Value = container.Env[idx].Value + javaJVMArgument  
}

// copy javaagent.jar
pod.Spec.InitContainers = append(pod.Spec.InitContainers, corev1.Container{  
    Name:      javaInitContainerName,  
    Image:     javaSpec.Image,  
    Command:   []string{"cp", "/javaagent.jar", javaInstrMountPath + "/javaagent.jar"},  
    Resources: javaSpec.Resources,  
    VolumeMounts: []corev1.VolumeMount{{  
       Name:      javaVolumeName,  
       MountPath: javaInstrMountPath,  
    }},})
```

大致的运行原理是当有 Pod 的事件发生了变化（重启、重新部署等），operator 就会检测到变化，此时会判断是否开启了刚才的注解：
```yaml
instrumentation.opentelemetry.io/inject-java: "true"
```

接着会写入环境变量 `JAVA_TOOL_OPTIONS`，同时将 jar 包从 InitContainers 中复制到业务容器中。

> 这里使用到了 kubernetes 的初始化容器，该容器是用于做一些准备工作的，比如依赖安装、配置检测或者是等待其他一些组件启动成功后再启动业务容器。

目前这个 operator 还处于使用阶段，同时部分功能还不满足（比如支持自定义扩展），今后有时间也可以分析下它的运行原理。

参考链接：
- https://xie.infoq.cn/article/e6def1e245e9d67735bd00dd5
- https://github.com/open-telemetry/opentelemetry-operator/#opentelemetry-auto-instrumentation-injection



