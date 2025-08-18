---
title: SSM(十七) MQ应用
date: 2017/10/20 01:01:54       
categories: 
- SSM
tags: 
- Kafka
- Java
---
![](https://i.loli.net/2019/05/08/5cd1ba77119c6.jpg)

# 前言
写这篇文章的起因是由于之前的一篇关于`Kafka`[异常消费](http://crossoverjie.top/2017/09/05/SSM16/)，当时为了解决问题不得不使用临时的方案。

总结起来归根结底还是对Kafka不熟悉导致的，加上平时工作的需要，之后就花些时间看了`Kafka`相关的资料。

# 何时使用MQ
谈到`Kafka`就不得不提到MQ，是属于消息队列的一种。作为一种基础中间件在互联网项目中有着大量的使用。

一种技术的产生自然是为了解决某种需求，通常来说是以下场景：

> - 需要跨进程通信：B系统需要A系统的输出作为输入参数。
> - 当A系统的输出能力远远大于B系统的处理能力。

针对于第一种情况有两种方案:

- 使用`RPC`远程调用,A直接调用B。
- 使用`MQ`,A发布消息到`MQ`,B订阅该消息。

当我们的需求是:A调用B实时响应，并且实时关心响应结果则使用`RPC`，这种情况就得使用同步调用。

<!--more-->

反之当我们并不关心调用之后的执行结果，并且有可能被调用方的执行非常耗时，这种情况就非常适合用`MQ`来达到异步调用目的。

比如常见的登录场景就只能用同步调用的方式，因为这个过程需要实时的响应结果，总不能在用户点了登录之后排除网络原因之外再额外的等几秒吧。

但类似于用户登录需要奖励积分的情况则使用`MQ`会更好，因为登录并不关系积分的情况，只需要发个消息到`MQ`,处理积分的服务订阅处理即可，这样还可以解决积分系统故障带来的雪崩效应。

`MQ`还有一个基础功能则是**限流削峰**，这对于大流量的场景如果将请求直接调用到B系统则非常有可能使B系统出现不可用的情况。这种场景就非常适合将请求放入`MQ`，不但可以利用`MQ`削峰还尽可能的保证系统的高可用。

# Kafka简介
本次重点讨论下`Kafka`。
简单来说`Kafka`是一个支持水平扩展，高吞吐率的分布式消息系统。

`Kafka`的常用知识:

- `Topic`:生产者和消费者的交互都是围绕着一个`Topic`进行的，通常来说是由业务来进行区分，由生产消费者协商之后进行创建。

- `Partition`(分区):是`Topic`下的组成，通常一个`Topic`下有一个或多个分区，消息生产之后会按照一定的算法负载到每个分区，所以分区也是`Kafka`性能的关键。当发现性能不高时便可考虑新增分区。

结构图如下:
![](https://i.loli.net/2019/05/08/5cd1ba7910bc2.jpg)

# 创建`Topic`
`Kafka`的安装官网有非常详细的讲解。这里谈一下在日常开发中常见的一些操作，比如创建`Topic`：

```shell
sh bin/kafka-topics.sh --create --zookeeper localhost:2181 --replication-factor 1 --partitions 3 --topic `test`
```
创建了三个分区的`test`主题。

使用

```shell
sh bin/kafka-topics.sh --list --zookeeper localhost:2181
```
可以列出所有的`Topic`。

# Kafka生产者
使用`kafka`官方所提供的`Java API`来进行消息生产，实际使用中编码实现更为常用:

```java
/** Kafka生产者
 * @author crossoverJie
 */
public class Producer {
    private static final Logger LOGGER = LoggerFactory.getLogger(Producer.class);

    /**
     * 消费配置文件
     */
    private static String consumerProPath;

    public static void main(String[] args) throws IOException {
        // set up the producer
        consumerProPath = System.getProperty("product_path");
        KafkaProducer<String, String> producer = null;
        try {
            FileInputStream inputStream = new FileInputStream(new File(consumerProPath));
            Properties properties = new Properties();
            properties.load(inputStream);
            producer = new KafkaProducer<String, String>(properties);

        } catch (IOException e) {
            LOGGER.error("load config error", e);
        }

        try {
            // send lots of messages
            for (int i=0 ;i<100 ; i++){
                producer.send(new ProducerRecord<String, String>(
                        "topic_optimization", i+"", i+""));

            }
        } catch (Throwable throwable) {
            System.out.printf("%s", throwable.getStackTrace());
        } finally {
            producer.close();
        }

    }
}
```
再配合以下启动参数即可发送消息:
```
-Dproduct_path=/xxx/producer.properties
```
以及生产者的配置文件:
```properties
#集群地址，可以多个
bootstrap.servers=10.19.13.51:9094
acks=all
retries=0
batch.size=16384
auto.commit.interval.ms=1000
linger.ms=0
key.serializer=org.apache.kafka.common.serialization.StringSerializer
value.serializer=org.apache.kafka.common.serialization.StringSerializer
block.on.buffer.full=true
```
具体的配置说明详见此处:[https://kafka.apache.org/0100/documentation.html#theproducer](https://kafka.apache.org/0100/documentation.html#theproducer)

流程非常简单，其实就是一些`API`的调用。

消息发完之后可以通过以下命令查看队列内的情况:
```shell
sh kafka-consumer-groups.sh --bootstrap-server localhost:9094 --describe --group group1 
```
![](https://i.loli.net/2019/05/08/5cd1ba7c8876f.jpg)
其中的`lag`便是队列里的消息数量。

# Kafka消费者
有了生产者自然也少不了消费者，这里首先针对单线程消费:

```java
/**
 * Function:kafka官方消费
 *
 * @author crossoverJie
 *         Date: 2017/10/19 01:11
 * @since JDK 1.8
 */
public class KafkaOfficialConsumer {
    private static final Logger LOGGER = LoggerFactory.getLogger(KafkaOfficialConsumer.class);

    /**
     * 日志文件地址
     */
    private static String logPath;

    /**
     * 主题名称
     */
    private static String topic;

    /**
     * 消费配置文件
     */
    private static String consumerProPath ;


    /**
     * 初始化参数校验
     * @return
     */
    private static boolean initCheck() {
        topic = System.getProperty("topic") ;
        logPath = System.getProperty("log_path") ;
        consumerProPath = System.getProperty("consumer_pro_path") ;
        if (StringUtil.isEmpty(topic) || logPath.isEmpty()) {
            LOGGER.error("system property topic ,consumer_pro_path, log_path is required !");
            return true;
        }
        return false;
    }

    /**
     * 初始化kafka配置
     * @return
     */
    private static KafkaConsumer<String, String> initKafkaConsumer() {
        KafkaConsumer<String, String> consumer = null;
        try {
            FileInputStream inputStream = new FileInputStream(new File(consumerProPath)) ;
            Properties properties = new Properties();
            properties.load(inputStream);
            consumer = new KafkaConsumer<String, String>(properties);
            consumer.subscribe(Arrays.asList(topic));

        } catch (IOException e) {
            LOGGER.error("加载consumer.props文件出错", e);
        }
        return consumer;
    }

    public static void main(String[] args) {
        if (initCheck()){
            return;
        }

        int totalCount = 0 ;
        long totalMin = 0L ;
        int count = 0;
        KafkaConsumer<String, String> consumer = initKafkaConsumer();

        long startTime = System.currentTimeMillis() ;
        //消费消息
        while (true) {
            ConsumerRecords<String, String> records = consumer.poll(200);
            if (records.count() <= 0){
                continue ;
            }
            LOGGER.debug("本次获取:"+records.count());
            count += records.count() ;

            long endTime = System.currentTimeMillis() ;
            LOGGER.debug("count=" +count) ;
            if (count >= 10000 ){
                totalCount += count ;
                LOGGER.info("this consumer {} record，use {} milliseconds",count,endTime-startTime);
                totalMin += (endTime-startTime) ;
                startTime = System.currentTimeMillis() ;
                count = 0 ;
            }
            LOGGER.debug("end totalCount={},min={}",totalCount,totalMin);

            /*for (ConsumerRecord<String, String> record : records) {
                record.value() ;
                JsonNode msg = null;
                try {
                    msg = mapper.readTree(record.value());
                } catch (IOException e) {
                    LOGGER.error("消费消息出错", e);
                }
                LOGGER.info("kafka receive = "+msg.toString());
            }*/


        }
    }
}
```
配合以下启动参数:
```
-Dlog_path=/log/consumer.log -Dtopic=test -Dconsumer_pro_path=consumer.properties
```
其中采用了轮询的方式获取消息，并且记录了消费过程中的数据。

消费者采用的配置:
```
bootstrap.servers=192.168.1.2:9094
group.id=group1

# 自动提交
enable.auto.commit=true
key.deserializer=org.apache.kafka.common.serialization.StringDeserializer
value.deserializer=org.apache.kafka.common.serialization.StringDeserializer

# fast session timeout makes it more fun to play with failover
session.timeout.ms=10000

# These buffer sizes seem to be needed to avoid consumer switching to
# a mode where it processes one bufferful every 5 seconds with multiple
# timeouts along the way.  No idea why this happens.
fetch.min.bytes=50000
receive.buffer.bytes=262144
max.partition.fetch.bytes=2097152
```
为了简便我采用的是自动提交`offset`。

## 消息存放机制
谈到`offset`就必须得谈谈Kafka的消息存放机制.

`Kafka`的消息不会因为消费了就会立即删除，所有的消息都会持久化到日志文件，并配置有过期时间，到了时间会自动删除过期数据，*并且不会管其中的数据是否被消费过。*

由于这样的机制就必须的有一个标志来表明哪些数据已经被消费过了，`offset(偏移量)`就是这样的作用，它类似于指针指向某个数据，当消费之后`offset`就会线性的向前移动，这样一来的话消息是可以被任意消费的，只要我们修改`offset`的值即可。

消费过程中还有一个值得注意的是:
> 同一个consumer group(group.id相等)下只能有一个消费者可以消费，这个刚开始确实会让很多人踩坑。

# 多线程消费

针对于单线程消费实现起来自然是比较简单，但是效率也是要大打折扣的。

为此我做了一个测试，使用之前的单线程消费120009条数据的结果如下:

![](https://i.loli.net/2019/05/08/5cd1ba8705aac.jpg)
总共花了12450毫秒。

那么换成多线程消费怎么实现呢？

我们可以利用`partition`的分区特性来提高消费能力，单线程的时候等于是一个线程要把所有分区里的数据都消费一遍，如果换成多线程就可以让一个线程只消费一个分区,这样效率自然就提高了，所以线程数`coreSize<=partition`。

首先来看下入口:

```
public class ConsumerThreadMain {
    private static String brokerList = "localhost:9094";
    private static String groupId = "group1";
    private static String topic = "test";

    /**
     * 线程数量
     */
    private static int threadNum = 3;

    public static void main(String[] args) {


        ConsumerGroup consumerGroup = new ConsumerGroup(threadNum, groupId, topic, brokerList);
        consumerGroup.execute();
    }
}
```
其中的`ConsumerGroup`类:
```
public class ConsumerGroup {
    private static Logger LOGGER = LoggerFactory.getLogger(ConsumerGroup.class);
    /**
     * 线程池
     */
    private ExecutorService threadPool;

    private List<ConsumerCallable> consumers ;

    public ConsumerGroup(int threadNum, String groupId, String topic, String brokerList) {
        ThreadFactory namedThreadFactory = new ThreadFactoryBuilder()
                .setNameFormat("consumer-pool-%d").build();

        threadPool = new ThreadPoolExecutor(threadNum, threadNum,
                0L, TimeUnit.MILLISECONDS,
                new LinkedBlockingQueue<Runnable>(1024), namedThreadFactory, new ThreadPoolExecutor.AbortPolicy());


        consumers = new ArrayList<ConsumerCallable>(threadNum);
        for (int i = 0; i < threadNum; i++) {
            ConsumerCallable consumerThread = new ConsumerCallable(brokerList, groupId, topic);
            consumers.add(consumerThread);
        }
    }

    /**
     * 执行任务
     */
    public void execute() {
        long startTime = System.currentTimeMillis() ;
        for (ConsumerCallable runnable : consumers) {
            Future<ConsumerFuture> future = threadPool.submit(runnable) ;
        }
        if (threadPool.isShutdown()){
            long endTime = System.currentTimeMillis() ;
            LOGGER.info("main thread use {} Millis" ,endTime -startTime) ;
        }
        threadPool.shutdown();
    }
}
```
最后真正的执行逻辑`ConsumerCallable`:
```
public class ConsumerCallable implements Callable<ConsumerFuture> {
    private static Logger LOGGER = LoggerFactory.getLogger(ConsumerCallable.class);

    private AtomicInteger totalCount = new AtomicInteger() ;
    private AtomicLong totalTime = new AtomicLong() ;

    private AtomicInteger count = new AtomicInteger() ;

    /**
     * 每个线程维护KafkaConsumer实例
     */
    private final KafkaConsumer<String, String> consumer;

    public ConsumerCallable(String brokerList, String groupId, String topic) {
        Properties props = new Properties();
        props.put("bootstrap.servers", brokerList);
        props.put("group.id", groupId);
        //自动提交位移
        props.put("enable.auto.commit", "true");
        props.put("auto.commit.interval.ms", "1000");
        props.put("session.timeout.ms", "30000");
        props.put("key.deserializer", "org.apache.kafka.common.serialization.StringDeserializer");
        props.put("value.deserializer", "org.apache.kafka.common.serialization.StringDeserializer");
        this.consumer = new KafkaConsumer<>(props);
        consumer.subscribe(Arrays.asList(topic));
    }


    /**
     * Computes a result, or throws an exception if unable to do so.
     *
     * @return computed result
     * @throws Exception if unable to compute a result
     */
    @Override
    public ConsumerFuture call() throws Exception {
        boolean flag = true;
        int failPollTimes = 0 ;
        long startTime = System.currentTimeMillis() ;
        while (flag) {
            // 使用200ms作为获取超时时间
            ConsumerRecords<String, String> records = consumer.poll(200);
            if (records.count() <= 0){
                failPollTimes ++ ;

                if (failPollTimes >= 20){
                    LOGGER.debug("达到{}次数，退出 ",failPollTimes);
                    flag = false ;
                }

                continue ;
            }

            //获取到之后则清零
            failPollTimes = 0 ;

            LOGGER.debug("本次获取:"+records.count());
            count.addAndGet(records.count()) ;
            totalCount.addAndGet(count.get()) ;
            long endTime = System.currentTimeMillis() ;
            if (count.get() >= 10000 ){
                LOGGER.info("this consumer {} record，use {} milliseconds",count,endTime-startTime);
                totalTime.addAndGet(endTime-startTime) ;
                startTime = System.currentTimeMillis() ;
                count = new AtomicInteger();
            }
            LOGGER.debug("end totalCount={},min={}",totalCount,totalTime);

            /*for (ConsumerRecord<String, String> record : records) {
                // 简单地打印消息
                LOGGER.debug(record.value() + " consumed " + record.partition() +
                        " message with offset: " + record.offset());
            }*/
        }

        ConsumerFuture consumerFuture = new ConsumerFuture(totalCount.get(),totalTime.get()) ;
        return consumerFuture ;

    }
}

```
理一下逻辑:
> 其实就是初始化出三个消费者实例，用于三个线程消费。其中加入了一些统计，最后也是消费120009条数据结果如下。

![](https://i.loli.net/2019/05/08/5cd1ba8b41500.jpg)

由于是并行运行，可见消费120009条数据可以提高2秒左右，当数据以更高的数量级提升后效果会更加明显。

但这也有一些弊端:
- 灵活度不高，当分区数量变更之后不能自适应调整。
- 消费逻辑和处理逻辑在同一个线程，如果处理逻辑较为复杂会影响效率，耦合也较高。当然这个处理逻辑可以再通过一个内部队列发出去由另外的程序来处理也是可以的。

# 总结


`Kafka`的知识点还是较多，`Kafka`的使用也远不这些。之后会继续分享一些关于`Kafka`监控等相关内容。

> 项目地址：[https://github.com/crossoverJie/SSM.git](https://github.com/crossoverJie/SSM.git)

> 个人博客：[http://crossoverjie.top](http://crossoverjie.top)。

