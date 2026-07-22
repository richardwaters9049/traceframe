FROM minio/minio:RELEASE.2025-09-07T16-13-09Z

EXPOSE 10000 10001

CMD ["server", "/data", "--address", ":10000", "--console-address", ":10001"]
