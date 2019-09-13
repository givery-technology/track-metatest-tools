# track-metatest-tools
Tools to perform Track metatesting

## Usage

### `checkcover`

Checks unit test coverage and reports the result as TAP format.

```
Usage:
  checkcover (jacoco|cobertura) <path> with config <config> [count from <offset>]
```


### Configuration file

example:

```
- target:
    type: method
    name: track.Main.doSomething
  conditions:
    line: 1
- target:
    type: method
    name: track.Main.doSomething
  conditions:
    branch: 0.9
- target:
    type: method
    name: track.Main.doAnother
  conditions:
    line: 0.9
- target:
    type: method
    name: track.Main.doAnother
  conditions:
    branch: 0.8
```

This create a test case which checks:

* Method `track.Main.doSomething`: C0 100%, C1 90%
* Method `track.Main.doAnother`: C0 90%, C1 80%

### `metatest`

Metatesting tool.

```
Usage:
  metatest copy <src> to <dest>
  metatest copy <src> to <dest> and <exec> then (junit|xunit) <xml> should (pass|fail) as <testcase_name> [count from <offset>]
  metatest do <exec> then (junit|xunit) <xml> should (pass|fail) as <testcase_name> [count from <offset>]
  metatest do <exec> then expand (junit|xunit) <xml> [with mappings <mappings>] [count from <offset>]
```

## License

This software is released under the [MIT License](LICENSE).
