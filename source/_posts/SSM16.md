---
title: SSM(十六) 曲线救国-Kafka消费异常
date: 2017/09/05 11:01:54       
categories: 
- SSM
tags: 
- Kafka
- shell
- Java
---
![封面](https://i.loli.net/2019/05/08/5cd1bad139575.jpg)

# 前言

最近线上遇到一个问题:在消费`kafka`消息的时候如果长时间(`大概半天到一天的时间`)队列里没有消息就可能再也消费不了。针对这个问题我们反复调试多次。线下模拟，调整代码，但貌似还是没有找到原因。**但是只要重启消费进程就又可以继续消费。**

# 解决方案

由于线上业务非常依赖`kafka`的消费，但一时半会也没有找到原因，所以最后只能想一个临时的替换方案：

> 基于重启就可以消费这个特点，我们在每次消费的时候都记下当前的时间点，当这个时间点在十分钟之内都没有更新我们就认为当前队列中没有消息了，就需要重启下消费进程。

既然是需要重启，`由于目前还没有上分布式调度中心`所以需要`crontab`来配合调度：每隔一分钟会调用一个`shell脚本`，该脚本会判断当前进程是否存在，如果存在则什么都不作，不存在则启动消费进程。

<!--more-->

# 具体实现

消费程序:
```java

/**
 * kafka消费
 *
 * @author crossoverJie
 * @date 2017年6月19日 下午3:15:16
 */
public class KafkaMsgConsumer {
    private static final Logger LOGGER = LoggerFactory.getLogger(KafkaMsgConsumer.class);

    private static final int CORE_POOL_SIZE = 4;
    private static final int MAXIMUM_POOL_SIZE = 4;
    private static final int BLOCKING_QUEUE_CAPACITY = 4000;
    private static final String KAFKA_CONFIG = "kafkaConfig";
    private static final ExecutorService fixedThreadPool = new ThreadPoolExecutor(CORE_POOL_SIZE, MAXIMUM_POOL_SIZE, 0L, TimeUnit.MILLISECONDS, new ArrayBlockingQueue<Runnable>(BLOCKING_QUEUE_CAPACITY));

    //最后更新时间
    private static AtomicLong LAST_MESSAGE_TIME = new AtomicLong(DateUtil.getLongTime());

    private static MsgIterator iter = null;
    private static String topic;//主题名称

    static {
        Properties properties = new Properties();
        String path = System.getProperty(KAFKA_CONFIG);
        checkArguments(!StringUtils.isBlank(path), "启动参数中没有配置kafka_easyframe_msg参数来指定kafka启动参数，请使用-DkafkaConfig=/path/fileName/easyframe-msg.properties");
        try {
            properties.load(new FileInputStream(new File(path)));
        } catch (IOException e) {
            LOGGER.error("IOException" ,e);
        }
        EasyMsgConfig.setProperties(properties);

    }

    private static void iteratorTopic() {
        if (iter == null) {
            iter = MsgUtil.consume(topic);
        }
        long i = 0L;
        while (iter.hasNext()) {
            i++;
            if (i % 10000 == 0) {
                LOGGER.info("consume i:" + i);
            }
            try {
                String message = iter.next();
                if (StringUtils.isEmpty(message)) {
                    continue;
                }
                LAST_MESSAGE_TIME = new AtomicLong(DateUtil.getLongTime());

                //处理消息
                LOGGER.debug("msg = " + JSON.toJSONString(message));
            } catch (Exception e) {
                LOGGER.error("KafkaMsgConsumer err:", e);
                try {
                    Thread.sleep(1000);
                } catch (InterruptedException e1) {
                    LOGGER.error("Thread InterruptedException", e1);
                }
                break;
            }
        }
    }

    public static void main(String[] args) {
        topic = System.getProperty("topic");
        checkArguments(!StringUtils.isBlank(topic), "system property topic or log_path is must!");
        while (true) {
            try {
                iteratorTopic();
            } catch (Exception e) {
                MsgUtil.shutdownConsummer();
                iter = null;

                LOGGER.error("KafkaMsgConsumer err:", e);
                try {
                    Thread.sleep(1000);
                } catch (InterruptedException e1) {
                    LOGGER.error("Thread InterruptedException", e1);
                }
            } finally {
                //此处关闭之后，由crontab每分钟检查一次，挂掉的话会重新拉起来
                if (DateUtil.getLongTime() - LAST_MESSAGE_TIME.get() > 10 * 60) { //10分钟
                    fixedThreadPool.shutdown();
                    LOGGER.info("线程池是否关闭：" + fixedThreadPool.isShutdown());
                    try {
                        //当前线程阻塞10ms后，去检测线程池是否终止，终止则返回true
                        while (!fixedThreadPool.awaitTermination(10, TimeUnit.MILLISECONDS)) {
                            LOGGER.info("检测线程池是否终止：" + fixedThreadPool.isTerminated());
                        }
                    } catch (InterruptedException e) {
                        LOGGER.error("等待线程池关闭错误", e);
                    }
                    LOGGER.info("线程池是否终止：" + fixedThreadPool.isTerminated());
                    LOGGER.info("in 10 min dont have data break");
                    break;
                }
            }
        }
        LOGGER.info("app shutdown");
        System.exit(0);
    }

}

```
[在线代码](https://github.com/crossoverJie/SSM/blob/master/SSM-WEB/src/main/java/com/crossoverJie/kafka/KafkaMsgConsumer.java#L31-L128)

需要配合以下这个`shell脚本运行`:

```shell
#!/bin/sh

#crontab
# * * * * * sh /data/schedule/kafka/run-kafka-consumer.sh >>/data/schedule/kafka/run-sms-log.log

# 如果进程存在就不启动
a1=`ps -ef|grep 'KafkaMsgConsumer'|grep -v grep|wc -l`
if [ $a1 -gt 0  ];then
        echo "=======     `date +'%Y-%m-%d %H:%M:%S'` KafkaMsgConsumer  is EXIT...=======     "
        exit
fi
LANG="zh_CN.UTF-8"
nohup /opt/java/jdk1.7.0_80/bin/java -d64 -Djava.security.egd=file:/dev/./urandom
-Djava.ext.dirs=/opt/tomcat/webapps/ROOT/WEB-INF/lib
-Dtopic=TOPIC_A
-Dlogback.configurationFile=/data/schedule/kafka/logback.xml
-DkafkaConfig=/opt/tomcat/iopconf/easyframe-msg.properties
-classpath /opt/tomcat/webapps/ROOT/WEB-INF/classes com.crossoverJie.kafka.SMSMsgConsumer >> /data/schedule/kafka/smslog/kafka.log 2>&1 &

echo "`date +'%Y-%m-%d %H:%M:%S'`  KafkaMsgConsumer running...."
```
[在线代码](https://github.com/crossoverJie/SSM/blob/master/SSM-WEB/src/main/resources/script/run-kafka-consumer.sh)

再配合`crontab`的调度:
```
* * * * * sh /data/schedule/kafka/run-kafka-consumer.sh >>/data/schedule/kafka/run-sms-log.log
```
即可。

# 总结

虽说处理起来很简单，但依然是治标不治本，依赖的东西比较多(`shell脚本，调度`)。
所以也问问各位有没有什么思路：

- 消费程序用的:[https://github.com/linzhaoming/easyframe-msg](https://github.com/linzhaoming/easyframe-msg)

生产配置:
- 三台`kafka、ZK`组成的集群。

其中也有其他团队的消费程序在正常运行，应该和`kafka`的配置没有关系。

> 项目地址：[https://github.com/crossoverJie/SSM.git](https://github.com/crossoverJie/SSM.git)

> 个人博客：[http://crossoverjie.top](http://crossoverjie.top)。


