SimpleBGC Wrapper for C library

# Example

```javascript

    

```

# Development

## Update source files

### Get the latest (master branch)
```shell
wget https://github.com/alexmos/sbgc-api-examples/archive/master.tar.gz
```

### Extract and move the files
```shell
tar -zxvf master.tar.gz
mv sbgc-api-examples-master/libraries/SBGC_lib/* ./
rm -rf sbgc-api-examples-master/
rm master.tar.gz
```

### Compile
```shell
swig -c++ -javascript -node SBGC.i
swig -c++ -javascript -node -I./include/ SBGC.i
node-gyp configure build
```