---
title: 一份针对于新手的多线程实践
date: 2018/10/29 01:00:16 
categories: 
- Java 进阶
tags: 
- Java
- ThreadPool
- SpringBoot
---

![](https://i.loli.net/2019/05/08/5cd1c697587d0.jpg)


# 前言


![](https://i.loli.net/2019/05/08/5cd1c69801b99.jpg)

前段时间在某个第三方平台看到我写作字数居然突破了 10W 字，难以想象高中 800 字作文我都得巧妙的**利用换行**来完成(懂的人肯定也干过😏)。

干了这行养成了一个习惯：能撸码验证的事情都自己验证一遍。

于是在上周五通宵加班的空余时间写了一个工具：

[https://github.com/crossoverJie/NOWS](https://github.com/crossoverJie/NOWS)

利用 `SpringBoot` 只需要一行命令即可统计自己写了多少个字。

```shell
java -jar nows-0.0.1-SNAPSHOT.jar /xx/Hexo/source/_posts
```

<!--more-->

传入需要扫描的文章目录即可输出结果（目前只支持 `.md` 结尾 `Markdown` 文件）

![](https://i.loli.net/2019/05/08/5cd1c69c8aeb9.jpg)

当然结果看个乐就行（40 几万字），因为早期的博客我喜欢大篇的贴代码，还有一些英文单词也没有过滤，所以导致结果相差较大。

> 如果仅仅只是中文文字统计肯定是准的，并且该工具内置灵活的扩展方式，使用者可以自定义统计策略，具体请看后文。

其实这个工具挺简单的，代码量也少，没有多少可以值得拿出来讲的。但经过我回忆不管是面试还是和网友们交流都发现一个普遍的现象：

> 大部分**新手开发**都会去看多线程、但几乎都没有相关的实践。甚至有些都不知道多线程拿来在实际开发中有什么用。


为此我想基于这个简单的工具为这类朋友带来一个可实践、易理解的多线程案例。

至少可以让你知道：

- 为什么需要多线程？
- 怎么实现一个多线程程序？
- 多线程带来的问题及解决方案？


# 单线程统计

再谈多线程之前先来聊聊单线程如何实现。

本次的需求也很简单，只是需要扫描一个目录读取下面的所有文件即可。

所有我们的实现有以下几步：

- 读取某个目录下的所有文件。
- 将所有文件的路径保持到内存。
- 遍历所有的文件挨个读取文本记录字数即可。

先来看前两个如何实现，并且当扫描到目录时需要继续读取当前目录下的文件。

这样的场景就非常适合递归：

```java
    public List<String> getAllFile(String path){

        File f = new File(path) ;
        File[] files = f.listFiles();
        for (File file : files) {
            if (file.isDirectory()){
                String directoryPath = file.getPath();
                getAllFile(directoryPath);
            }else {
                String filePath = file.getPath();
                if (!filePath.endsWith(".md")){
                    continue;
                }
                allFile.add(filePath) ;
            }
        }

        return allFile ;
    }
}
```

读取之后将文件的路径保持到一个集合中。

> 需要注意的是这个递归次数需要控制下，避免出现栈溢出(`StackOverflow`)。

最后读取文件内容则是使用 `Java8` 中的流来进行读取，这样代码可以更简洁：

```java
Stream<String> stringStream = Files.lines(Paths.get(path), StandardCharsets.UTF_8);
List<String> collect = stringStream.collect(Collectors.toList());
```

接下来便是读取字数，同时要过滤一些特殊文本（比如我想过滤掉所有的空格、换行、超链接等）。

# 扩展能力

简单处理可在上面的代码中遍历 `collect` 然后把其中需要过滤的内容替换为空就行。

但每个人的想法可能都不一样。比如我只想过滤掉`空格、换行、超链接`就行了，但有些人需要去掉其中所有的英文单词，甚至换行还得留着（就像写作文一样可以充字数）。

所有这就需要一个比较灵活的处理方式。

看过上文[《利用责任链模式设计一个拦截器》](https://crossoverjie.top/2018/10/22/wheel/cicada5/)应该很容易想到这样的场景责任链模式再合适不过了。

关于`责任链模式`具体的内容就不在详述了，感兴趣的可以查看[上文](https://crossoverjie.top/2018/10/22/wheel/cicada5/)。

这里直接看实现吧：

定义责任链的抽象接口及处理方法：

```java
public interface FilterProcess {
    /**
     * 处理文本
     * @param msg
     * @return
     */
    String process(String msg) ;
}
```

---
处理空格和换行的实现：

```java
public class WrapFilterProcess implements FilterProcess{
    @Override
    public String process(String msg) {
        msg = msg.replaceAll("\\s*", "");
        return msg ;
    }
}
```

---
处理超链接的实现：

```java
public class HttpFilterProcess implements FilterProcess{
    @Override
    public String process(String msg) {
        msg = msg.replaceAll("^((https|http|ftp|rtsp|mms)?:\\/\\/)[^\\s]+","");
        return msg ;
    }
}
```

---
这样在初始化时需要将这些处理 `handle` 都加入责任链中，同时提供一个 `API` 供客户端执行即可。

![](https://i.loli.net/2019/05/08/5cd1c69e73410.jpg)

这样一个简单的统计字数的工具就完成了。

# 多线程模式

在我本地一共就几十篇博客的条件下执行一次还是很快的，但如果我们的文件是几万、几十万甚至上百万呢。

虽然功能可以实现，但可以想象这样的耗时绝对是成倍的增加。

这时多线程就发挥优势了，由多个线程分别去读取文件最后汇总结果即可。

这样实现的过程就变为：

- 读取某个目录下的所有文件。
- 将文件路径交由不同的线程自行处理。
- 最终汇总结果。

## 多线程带来的问题

也不是使用多线程就万事大吉了，先来看看第一个问题：共享资源。

简单来说就是怎么保证多线程和单线程统计的总字数是一致的。

基于我本地的环境先看看单线程运行的结果：

![](https://i.loli.net/2019/05/08/5cd1c6a0cf61d.jpg)

总计为：414142 字。

接下来换为多线程的方式：

```java
List<String> allFile = scannerFile.getAllFile(strings[0]);
logger.info("allFile size=[{}]",allFile.size());
for (String msg : allFile) {
	executorService.execute(new ScanNumTask(msg,filterProcessManager));
}

public class ScanNumTask implements Runnable {

    private static Logger logger = LoggerFactory.getLogger(ScanNumTask.class);

    private String path;

    private FilterProcessManager filterProcessManager;

    public ScanNumTask(String path, FilterProcessManager filterProcessManager) {
        this.path = path;
        this.filterProcessManager = filterProcessManager;
    }

    @Override
    public void run() {
        Stream<String> stringStream = null;
        try {
            stringStream = Files.lines(Paths.get(path), StandardCharsets.UTF_8);
        } catch (Exception e) {
            logger.error("IOException", e);
        }

        List<String> collect = stringStream.collect(Collectors.toList());
        for (String msg : collect) {
            filterProcessManager.process(msg);
        }
    }
}

```


> 使用线程池管理线程，更多线程池相关的内容请看这里：[《如何优雅的使用和理解线程池》](https://crossoverjie.top/2018/07/29/java-senior/ThreadPool/)

执行结果：
![](https://i.loli.net/2019/05/08/5cd1c6a7b0f8f.jpg)

我们会发现无论执行多少次，这个值都会小于我们的预期值。

来看看统计那里是怎么实现的。

```java
@Component
public class TotalWords {
    private long sum = 0 ;

    public void sum(int count){
        sum += count;
    }

    public long total(){
        return sum;
    }
}
```

可以看到就是对一个基本类型进行累加而已。那导致这个值比预期小的原因是什么呢？

我想大部分人都会说：多线程运行时会导致有些线程把其他线程运算的值覆盖。

> 但其实这只是导致这个问题的表象，根本原因还是没有讲清楚。

## 内存可见性

核心原因其实是由 Java 内存模型（`JMM`）的规定导致的。

这里引用一段之前写的[《你应该知道的 volatile 关键字》](https://crossoverjie.top/2018/03/09/volatile/)一段解释：

> 由于 `Java` 内存模型(`JMM`)规定，所有的变量都存放在主内存中，而每个线程都有着自己的工作内存(高速缓存)。

> 线程在工作时，需要将主内存中的数据拷贝到工作内存中。这样对数据的任何操作都是基于工作内存(效率提高)，并且不能直接操作主内存以及其他线程工作内存中的数据，之后再将更新之后的数据刷新到主内存中。

>> 这里所提到的主内存可以简单认为是**堆内存**，而工作内存则可以认为是**栈内存**。

> 如下图所示：

![](https://i.loli.net/2019/05/08/5cd1c6a9c6546.jpg)

> 所以在并发运行时可能会出现线程 B 所读取到的数据是线程 A 更新之前的数据。

更多相关内容就不再展开了，感兴趣的朋友可以翻翻以前的博文。

直接来说如何解决这个问题吧，JDK 其实已经帮我们想到了这些问题。

在 `java.util.concurrent` 并发包下有许多你可能会使用到的并发工具。

这里就非常适合 `AtomicLong`，它可以原子性的对数据进行修改。

来看看修改后的实现：

```java
@Component
public class TotalWords {
    private AtomicLong sum = new AtomicLong() ;
    
    public void sum(int count){
        sum.addAndGet(count) ;
    }

    public  long total(){
        return sum.get() ;
    }
}
```

只是使用了它的两个 `API` 而已。再来运行下程序会发现**结果居然还是不对**。

![](https://i.loli.net/2019/05/08/5cd1c6ac29d9f.jpg)

甚至为 0 了。

## 线程间通信

这时又出现了一个新的问题，来看看获取总计数据是怎么实现的。

```java
List<String> allFile = scannerFile.getAllFile(strings[0]);
logger.info("allFile size=[{}]",allFile.size());
for (String msg : allFile) {
	executorService.execute(new ScanNumTask(msg,filterProcessManager));
}

executorService.shutdown();
long total = totalWords.total();
long end = System.currentTimeMillis();
logger.info("total sum=[{}],[{}] ms",total,end-start);
```

不知道大家看出问题没有，其实是在最后打印总数时并不知道其他线程是否已经执行完毕了。

因为 `executorService.execute()` 会直接返回，所以当打印获取数据时还没有一个线程执行完毕，也就导致了这样的结果。

关于线程间通信之前我也写过相关的内容：[《深入理解线程通信》](https://crossoverjie.top/2018/03/16/java-senior/thread-communication/)

大概的方式有以下几种：

![](https://i.loli.net/2019/05/08/5cd1c6ad47413.jpg)

这里我们使用线程池的方式：

在停用线程池后加上一个判断条件即可：

```java
executorService.shutdown();
while (!executorService.awaitTermination(100, TimeUnit.MILLISECONDS)) {
	logger.info("worker running");
}
long total = totalWords.total();
long end = System.currentTimeMillis();
logger.info("total sum=[{}],[{}] ms",total,end-start);
```

这样我们再次尝试，发现无论多少次结果都是正确的了：

![](https://i.loli.net/2019/05/08/5cd1c6b0c711c.jpg)

## 效率提升

可能还会有朋友问，这样的方式也没见提升多少效率啊。

这其实是由于我本地文件少，加上一个文件处理的耗时也比较短导致的。

甚至线程数开的够多导致频繁的上下文切换还是让执行效率降低。

为了模拟效率的提升，每处理一个文件我都让当前线程休眠 100 毫秒来模拟执行耗时。

先看单线程运行需要耗时多久。

![](https://i.loli.net/2019/05/08/5cd1c6b2e840c.jpg)

总共耗时：`[8404] ms`

接着在线程池大小为 4 的情况下耗时：

![](https://i.loli.net/2019/05/08/5cd1c6bc142b3.jpg)

![](https://i.loli.net/2019/05/08/5cd1c6bfdb822.jpg)

总共耗时：`[2350] ms`

可见效率提升还是非常明显的。

# 更多思考

这只是多线程其中的一个用法，相信看到这里的朋友应该多它的理解更进一步了。

再给大家留个阅后练习，场景也是类似的：

> 在 Redis 或者其他存储介质中存放有上千万的手机号码数据，每个号码都是唯一的，需要在最快的时间内把这些号码全部都遍历一遍。

有想法感兴趣的朋友欢迎在文末留言参与讨论🤔🤨。

# 总结

希望看完的朋友心中能对文初的几个问题能有自己的答案：

- 为什么需要多线程？
- 怎么实现一个多线程程序？
- 多线程带来的问题及解决方案？

文中的代码都在此处。

[https://github.com/crossoverJie/NOWS](https://github.com/crossoverJie/NOWS)


**你的点赞与转发是最大的支持。**
