---
title: StarRocks 开发环境搭建踩坑指北之存算分离篇
Date: 2025-01-20T17:24:00
banner_img: https://s2.loli.net/2025/08/15/P6IHONqyU4Jh3SR.png
index_img: https://s2.loli.net/2025/08/15/P6IHONqyU4Jh3SR.png
categories:
  - OB
  - StarRocks
tags:
  - StarRocks
---


前段时间碰到一个 StarRocks 物化视图的 [bug](https://github.com/StarRocks/starrocks/issues/55301): https://github.com/StarRocks/starrocks/issues/55301

但是这个问题只能在存算分离的场景下才能复现，为了找到问题原因我便尝试在本地搭建一个可以 Debug 的存算分离版本。

之前也分享过在[本地 Debug StarRocks](https://crossoverjie.top/2024/10/09/ob/StarRocks-dev-env-build/)，不过那是存算一体的版本，而存算分离稍微要复杂一些。

> 这里提到的本地 Debug 主要是指可以调试 FE，而 CN/BE 则是运行在容器环境，避免本地打包和构建运行环境。

---

<!--more-->

当前 StarRocks 以下的存算分离部署方式，在本地推荐直接使用 `MinIO` 部署。

![](https://s2.loli.net/2025/02/14/pTWsfE6XUxuCeiL.png)



## 启动 MinIO
首先第一步启动 MinIO:

```shell
docker run -d --rm --name minio \
  -e MINIO_ROOT_USER=miniouser \
  -e MINIO_ROOT_PASSWORD=miniopassword \
  -p 9001:9001 \
  -p 9000:9000 \
  --entrypoint sh \
  minio/minio:latest \
  -c 'mkdir -p /minio_data/starrocks && minio server /minio_data --console-address ":9001"'
```

进入 MinIO 容器设置 access token:
```shell
docker exec -it minio sh
mc alias set myminio http://10.0.9.20:9000 miniouser miniopassword; mc admin user svcacct add --access-key AAAAAAAAAAAAAAAAAAAA --secret-key BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB myminio miniouser
```

## 启动 cn:

```shell
docker run -p 9060:9060 -p 8040:8040 -p 9050:9050 -p 8060:8060 -p 9070:9070 -itd --rm --name cn -e "TZ=Asia/Shanghai" starrocks/cn-ubuntu:3.4-latest
```

修改 `cn.conf` :

```
cd cn/config/
echo "priority_networks = 10.0.9.20/24" >> cn.properties
```

 使用脚本手动启动 cn:

```shell
bin/start_cn.sh --daemon
```

使用以下配置在本地 IDEA 中启动 FE:

```properties
LOG_DIR = ${STARROCKS_HOME}/log  
  
DATE = "$(date +%Y%m%d-%H%M%S)"  
  
sys_log_level = INFO  
  
http_port = 8030  
rpc_port = 9020  
query_port = 9030  
edit_log_port = 9010  
mysql_service_nio_enabled = true  
  
run_mode = shared_data  
cloud_native_storage_type = S3  
aws_s3_endpoint = 10.0.9.20:9000  
# set the path in MinIO  
aws_s3_path = starrocks  
# credentials for MinIO object read/write  
# 这里的 key 为刚才设置的 access token
aws_s3_access_key = AAAAAAAAAAAAAAAAAAAA  
aws_s3_secret_key = BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB  
aws_s3_use_instance_profile = false  
aws_s3_use_aws_sdk_default_behavior = false  
# Set this to false if you do not want default  
# storage created in the object storage using  
# the details provided above  
enable_load_volume_from_conf = true  

# 本机 IP，需要与 cn 中的配置对齐
priority_networks = 10.0.9.20/24
```

启动 FE 之前最好先删除 `meta/.` 下的所有元数据文件然后再启动。
## 添加 CN 节点

FE 启动成功之后连接上 FE，然后手动添加 CN 节点。
```sql
ALTER SYSTEM ADD COMPUTE NODE "127.0.0.1:9050";
show compute nodes;
```
![](https://s2.loli.net/2025/01/20/OBXjoYAqP6DhMKs.png)


然后就可以创建存算分离的表了。

```sql
CREATE TABLE IF NOT EXISTS par_tbl1
(
    datekey DATETIME,
    k1      INT,
    item_id STRING,
    v2      INT
)PRIMARY KEY (`datekey`,`k1`)
 PARTITION BY date_trunc('day', `datekey`)
 PROPERTIES (
"compression" = "LZ4",
"datacache.enable" = "true",
"enable_async_write_back" = "false",
"enable_persistent_index" = "true",
"persistent_index_type" = "LOCAL",
"replication_num" = "1",
"storage_volume" = "builtin_storage_volume"
);
```


最终其实是参考官方提供的 docker-compose 的编排文件进行部署的：
https://raw.githubusercontent.com/StarRocks/demo/master/documentation-samples/quickstart/docker-compose.yml

> 如果只是想在本地搭建一个存算分离的版本，可以直接使用这个 docker compose.

其中有两个坑需要注意：
## 创建表超时

建表出现超时，提示需要配置时间:

```sql
admin set frontend config("tablet_create_timeout_second"="50")
```

配置也不能解决问题，依然会超时，可以看看本地是否有开启代理，尝试关闭代理试试看。

## unknown compression type(0) backend [id=10002]

不支持的压缩类型：这个问题我在使用 main 分支的 FE 与最新的 `starrocks/cn-ubuntu:3.4-latest` 的镜像会触发，当我把 FE 降低到具体到 tag 分支，比如 3.3.9 的时候就可以了。

具体原因就没有细究了，如果要本地 debug 使用最新的 tag 也能满足调试的需求。

参考链接：
- https://github.com/StarRocks/starrocks/issues/55301
- https://docs.starrocks.io/zh/docs/deployment/shared_data/minio/