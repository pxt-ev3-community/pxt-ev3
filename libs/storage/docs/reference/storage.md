# Storage

The Storage extension provides file access for the EV3 brick, including temporary, internal, and external storage.

It supports:

* Temporary storage
* Internal storage
* External storage
* Text files
* CSV files
* Easy name-value storage of numbers

## Storage locations

| Type      | Description                                                         |
| --------- | ------------------------------------------------------------------- |
| Temporary | Files stored in temporary memory and removed when the EV3 restarts. |
| Internal  | Files stored in the EV3 internal file system.                       |
| External  | Files stored on the SD card.                                        |

## File paths

### Temporary storage

Temporary files are stored in memory and automatically removed when the EV3 restarts.

Example:

```blocks
storage.temporary.append("log.txt", "Hello")
```

### Internal storage

Files are stored in the EV3 internal file system.

A file name without a path is automatically stored in:

```text
/home/root/lms2012/prjs/BrkProg_SAVE/
```

Example:

```text
data.rtf → /home/root/lms2012/prjs/BrkProg_SAVE/data.rtf
```

A relative path is stored inside the EV3 projects directory:

```text
Logs/data.rtf → /home/root/lms2012/prjs/Logs/data.rtf
```

Absolute Linux paths are used without modification:

```text
/home/root/data.rtf → /home/root/data.rtf
```

### External storage

Files are stored on the SD card in:

```text
/media/card/
```

Example:

```blocks
storage.external.append("data.rtf", "Hello")
```

### Name-value storage

Named values are stored in internal memory in a file based on project name.
Format is simple:

```text
name=123
```

## File formats

### Text files

For files that should be visible and readable in the EV3 interface, use the `.rtf` extension.

Example:

```text
notes.rtf
```

### CSV files

CSV files can be used to store tabular data.

Example:

```text
data.csv
```

The EV3 file browser does not display CSV files.

## Simulator support

Some file operations may behave differently in the simulator.

### Notes

* Simulator file access is not identical to the EV3 brick.
* Some APIs use simulator stubs.
* Large files may behave differently than on real hardware.

### Recommendation

Always test important storage code on a real EV3 brick.

## See also

* [Text files](storage/text-files)
* [CSV files](storage/csv-files)
* [Append text](storage/append)
* [Overwrite file](storage/overwrite)
* [Read file](storage/read)
* [File size](storage/size)
* [File limit](storage/limit)
