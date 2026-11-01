enum CSVSeparator {
    //% block="comma"
    Comma,
    //% block="semicolon"
    Semicolon
}

//% color="#FF7E14" weight=79 icon="\uf1c0" help=storage advanced=true
namespace storage {

    //% shim=storage::__unlink
    function __unlink(filename: string): void { }
    //% shim=storage::__truncate
    function __truncate(filename: string): void { }

    let csvSeparator: string = ",";


    function toCSV(data: number[], sep: string) {
        let s = "";
        for (const d of data) {
            if (s) s += sep;
            s = s + d;
        }
        s += "\r\n";
        return s;
    }

    function escapeCSV(value: string) {
        if (
            value.indexOf(csvSeparator) >= 0 ||
            value.indexOf('"') >= 0 ||
            value.indexOf('\r') >= 0 ||
            value.indexOf('\n') >= 0
        ) {
            let escaped = "";
            for (let i = 0; i < value.length; i++) {
                const ch = value.charAt(i);
                if (ch == '"') escaped += '""';
                else escaped += ch;
            }
            return '"' + escaped + '"';
        }

        return value;
    }

    function parseCSVRow(line: string, sep: string): string[] {
        let result: string[] = [];
        let current = "";
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const ch = line.charAt(i);
            if (ch == '"') {
                // escaped quote
                if (inQuotes && i + 1 < line.length && line.charAt(i + 1) == '"') {
                    current += '"';
                    i++;
                } else {
                    inQuotes = !inQuotes;
                }
            }
            else if (ch == sep && !inQuotes) {
                result.push(current);
                current = "";
            } else {
                current += ch;
            }
        }

        result.push(current);
        return result;
    }


    function separatorToString(sep: CSVSeparator): string {
        if (sep == CSVSeparator.Semicolon) return ";";
        return ",";
    }

    /**
     * Set for CSV file separator.
     * It is necessary to use depending on your regional settings of the application displaying CSV. By default, a comma is used.
     * @param sep separator character, eg: CSVSeparator.Comma
     */
    //% help=storage/set-csv-separator
    //% blockId=storageSetCSVSeparator
    //% block="storage CSV set $sep|separator"
    //% weight=80
    //% blockGap=8
    //% inlineInputMode=inline
    //% subcategory="Extra"
    //% group="Manage"
    export function setCSVSeparator(sep: CSVSeparator) {
        csvSeparator = separatorToString(sep);
    }


    //% fixedInstances
    export class Storage {

        constructor() {
        }

        protected mapFilename(filename: string) {
            return filename;
        }

        private getFile(filename: string): MMap {
            filename = this.mapFilename(filename);
            let r = control.mmap(filename, 0, 0);
            if (!r) {
                __mkdir(this.dirname(filename));
                __truncate(filename);
                r = control.mmap(filename, 0, 0);
            }
            if (!r) control.panic(906);
            return r;
        }

        dirname(filename: string) {
            let last = 0;
            for (let i = 0; i < filename.length; ++i) {
                if (filename[i] == "/") last = i;
            }
            return filename.substr(0, last);
        }

        /**
         * Append string data to a new or existing file.
         * If you plan to save a text file to the EV3's permanent memory, then you should use the rtf format, as it is displayed and readable in the EV3 interface.
         * If you specify PathName/data.rtf, you can save the file in a folder.
         * All user folders can be manually deleted on the controller.
         * @param filename the file name to append data, eg: "data.rtf"
         * @param data the data to append
         */
        //% help=storage/append
        //% blockId=storageAppend
        //% block="storage %source|$filename|append $data"
        //% weight=94
        //% blockGap=8
        //% inlineInputMode=inline
        //% group="Write"
        append(filename: string, data: string): void {
            this.appendBuffer(filename, __stringToBuffer(data));
        }

        /**
         * Appends a new line of data in the file.
         * If you plan to save a text file to the EV3's permanent memory, then you should use the rtf format, as it is displayed and readable in the EV3 interface.
         * If you specify PathName/data.rtf, you can save the file in a folder.
         * All user folders can be manually deleted on the controller.
         * @param filename the file name to append data, eg: "data.rtf"
         * @param data the data to append
         */
        //% help=storage/append-line
        //% blockId=storageAppendLine
        //% block="storage %source|$filename|append line $data"
        //% weight=93
        //% blockGap=8
        //% inlineInputMode=inline
        //% group="Write"
        appendLine(filename: string, data: string): void {
            this.append(filename, data + "\r\n");
        }

        /** Append a buffer to a new or existing file. */
        appendBuffer(filename: string, data: Buffer): void {
            let f = this.getFile(filename);
            f.lseek(0, SeekWhence.End);
            f.write(data);
        }

        /**
         * Overwrite CSV file and write header row.
         * If the file already exists, all previous contents will be removed.
         * @param filename the file name to overwrite, eg: "data.csv"
         * @param headers the header row
         */
        //% help=storage/overwrite-csv-headers
        //% blockId=storageOverwriteCSVHeaders
        //% block="storage %source|overwrite CSV $filename|headers $headers"
        //% weight=89
        //% blockGap=8
        //% inlineInputMode=inline
        //% subcategory="Extra"
        //% group="Write"
        overwriteCSVHeaders(filename: string, headers: string[]) {
            let s = "";
            for (const d of headers) {
                if (s) s += csvSeparator;
                s += d;
            }
            s += "\r\n";
            this.overwrite(filename, s);
        }

        /**
         * Append a row of CSV headers.
         * If you plan to store CSV in the EV3's persistent memory, the EV3 interface does not display this format.
         * @param filename the file name to append data, eg: "data.csv"
         * @param headers the data to append
         */
        //% help=storage/append-csv-headers
        //% blockId=storageAppendCSVHeaders
        //% block="storage %source|$filename|append CSV headers $headers"
        //% weight=88
        //% blockGap=8
        //% inlineInputMode=inline
        //% subcategory="Extra"
        //% group="Write"
        appendCSVHeaders(filename: string, headers: string[]) {
            let s = "";
            for (const d of headers) {
                if (s) s += csvSeparator;
                s += escapeCSV(d);
            }
            s += "\r\n";
            this.append(filename, s);
        }

        /**
         * Append a row of CSV data.
         * If you plan to store CSV in the EV3's persistent memory, the EV3 interface does not display this format.
         * @param filename the file name to append data, eg: "data.csv"
         * @param data the data to append
         */
        //% help=storage/append-csv
        //% blockId=storageAppendCSV
        //% block="storage %source|$filename|append CSV $data"
        //% weight=87
        //% blockGap=8
        //% inlineInputMode=inline
        //% subcategory="Extra"
        //% group="Write"
        appendCSV(filename: string, data: number[]) {
            let s = toCSV(data, csvSeparator);
            this.append(filename, s);
        }

        /**
         * Read CSV row as array of strings.
         * @param filename the CSV file name, eg: "data.csv"
         * @param row CSV row number starting from 0, eg: 0
         */
        //% help=storage/read-csv-row
        //% blockId=storageReadCSVRow
        //% block="storage %source|read CSV $filename|row $row"
        //% weight=86
        //% blockGap=8
        //% inlineInputMode=inline
        //% subcategory="Extra"
        //% group="Read"
        readCSVRow(filename: string, row: number): string[] {
            if (row < 0) return []; // Row does not exist
            const text = this.read(filename);
            let rows = text.split("\n"); // Split file into rows
            if (row >= rows.length) return []; // Row does not exist
            let line = rows[row].replace("\r", "");
            if (!line) return []; // Empty line
            return parseCSVRow(line, csvSeparator);
        }

        /**
         * Read CSV cell as string.
         * @param filename the CSV file name, eg: "data.csv"
         * @param row CSV row number starting from 0, eg: 0
         * @param column CSV column number starting from 0, eg: 0
         */
        //% help=storage/read-csv-cell
        //% blockId=storageReadCSVCell
        //% block="storage %source|read CSV cell $filename|row $row|column $column"
        //% weight=85
        //% blockGap=8
        //% inlineInputMode=inline
        //% subcategory="Extra"
        //% group="Read"
        readCSVCell(filename: string, row: number, column: number): string {
            if (column < 0) return ""; // Col does not exist
            let cells = this.readCSVRow(filename, row);
            if (column >= cells.length) return ""; // Col does not exist
            return cells[column];
        }

        /**
         * Get number of CSV rows.
         * @param filename the CSV file name, eg: "data.csv"
         */
        //% help=storage/csv-row-count
        //% blockId=storageCSVRowCount
        //% block="storage %source|$filename|CSV row count"
        //% weight=84
        //% blockGap=8
        //% inlineInputMode=inline
        //% subcategory="Extra"
        //% group="Read"
        csvRowCount(filename: string): number {
            const text = this.read(filename);
            if (!text) return 0;
            let rows = text.split("\n");
            if (rows.length > 0) { // Ignore trailing empty row caused by final CRLF
                let last = rows[rows.length - 1].replace("\r", "");
                if (!last) rows.pop();
            }
            return rows.length;
        }

        /**
         * Overwrite file with string data.
         * If you plan to save a text file to the EV3's permanent memory, then you should use the rtf format, as it is displayed and readable in the EV3 interface.
         * @param filename the file name to append data, eg: "data.rtf"
         * @param data the data to append
         */
        //% help=storage/overwrite
        //% blockId=storageOverwrite
        //% block="storage %source|$filename|overwrite with|$data"
        //% weight=95
        //% blockGap=8
        //% inlineInputMode=inline
        //% group="Write"
        overwrite(filename: string, data: string): void {
            this.overwriteWithBuffer(filename, __stringToBuffer(data));
        }

        /** Overwrite file with a buffer. */
        overwriteWithBuffer(filename: string, data: Buffer): void {
            __truncate(this.mapFilename(filename));
            this.appendBuffer(filename, data);
        }

        /**
         * Tests if a file exists.
         * @param filename the file name to append data, eg: "data.rtf"
         */
        //% help=storage/exists
        //% blockId=storageExists
        //% block="storage %source|$filename|exists"
        //% weight=99
        //% blockGap=8
        //% inlineInputMode=inline
        //% group="Read"
        exists(filename: string): boolean {
            return !!control.mmap(this.mapFilename(filename), 0, 0);
        }

        /**
         * Delete a file, or do nothing if it doesn't exist.
         * @param filename the file name to append data, eg: "data.rtf"
         */
        //% help=storage/remove
        //% blockId=storageRemove
        //% block="storage %source|remove $filename"
        //% weight=97
        //% blockGap=8
        //% inlineInputMode=inline
        //% group="Manage"
        remove(filename: string): void {
            __unlink(this.mapFilename(filename));
        }

        /**
         * Return the size of the file, or -1 if it doesn't exists.
         * @param filename the file name to append data, eg: "data.rtf"
         */
        //% help=storage/size
        //% blockId=storageSize
        //% block="storage %source|$filename|size"
        //% weight=98
        //% blockGap=8
        //% inlineInputMode=inline
        //% group="Read"
        size(filename: string): int32 {
            let f = control.mmap(this.mapFilename(filename), 0, 0);
            if (!f) return -1;
            return f.lseek(0, SeekWhence.End);
        }

        /**
         * Read contents of file as a string.
         * @param filename the file name to append data, eg: "data.rtf"
         */
        //% help=storage/read
        //% blockId=storageRead
        //% block="storage %source|read $filename|as string"
        //% weight=96
        //% blockGap=8
        //% inlineInputMode=inline
        //% group="Read"
        read(filename: string): string {
            return __bufferToString(this.readAsBuffer(filename));
        }

        /** Read contents of file as a buffer. */
        readAsBuffer(filename: string): Buffer {
            let f = this.getFile(filename);
            let sz = f.lseek(0, SeekWhence.End);
            let b = output.createBuffer(sz);
            f.lseek(0, SeekWhence.Set);
            f.read(b);
            return b;
        }

        /**
         * Resizing the size of a file to stay under the limit.
         * @param filename name of the file to drop, eg: "data.rtf"
         * @param size maximum length
         */
        //% help=storage/limit
        //% blockId=storageLimit
        //% block="storage %source|limit $filename|to $size|bytes"
        //% weight=100
        //% blockGap=8
        //% inlineInputMode=inline
        //% group="Manage"
        limit(filename: string, size: number) {
            if (!this.exists(filename) || size < 0) return;
            const sz = this.size(filename);
            if (sz > size) {
                let buf = this.readAsBuffer(filename);
                buf = buf.slice(buf.length / 2);
                this.overwriteWithBuffer(filename, buf);
            }
        }
    }


    class TemporaryStorage extends Storage {
        constructor() {
            super();
        }

        protected mapFilename(filename: string) {
            if (filename[0] == '/') filename = filename.slice(1);
            return '/tmp/logs/' + filename;
        }
    }

    /**
     * Temporary storage in memory, deleted when the device restarts.
     */
    //% whenUsed fixedInstance
    //% block="temporary"
    export const temporary: Storage = new TemporaryStorage();

    
    class InternalStorage extends Storage {
        constructor() {
            super();
        }

        protected mapFilename(filename: string) {
            // Save simple filenames into BrkProg_SAVE:
            // data.rtf -> /home/root/lms2012/prjs/BrkProg_SAVE/data.rtf
            if (filename.indexOf("/") < 0) {
                return "/home/root/lms2012/prjs/BrkProg_SAVE/" + filename;
            }

            // Save relative paths inside prjs:
            // MyPath/data.rtf -> /home/root/lms2012/prjs/MyPath/data.rtf
            if (filename[0] != "/") {
                return "/home/root/lms2012/prjs/" + filename;
            }

            // Keep absolute Linux paths unchanged:
            // /home/root/data.rtf
            // /media/card/data.rtf
            // /mnt/ramdisk/data.rtf
            return filename;
        }
    }

    /**
     * Internal storage on the brick, must be deleted with code.
     */
    //% whenUsed fixedInstance
    //% block="internal"
    export const internal: Storage = new InternalStorage();


    class ExternalStorage extends Storage {
        constructor() {
            super();
        }

        protected mapFilename(filename: string) {
            if (filename[0] == '/') filename = filename.slice(1);
            return '/media/card/' + filename;
        }
    }

    /**
     * External storage on the sd card.
     */
    //% whenUsed fixedInstance
    //% block="external"
    export const external: Storage = new ExternalStorage();


    // Automatically send console output to temp storage
    storage.temporary.remove("console.txt");
    console.addListener(function(line) {
        const fn = "console.txt";
        const t = control.millis();
        storage.temporary.appendLine(fn, `${t}> ${line}`);
        storage.temporary.limit(fn, 65536);
    });

    /**
     * Easy storage of values to a file with name based on the project
     * name.
     */
    class StoredValues {
        data: { [key: string]: number } = {};
        loaded: boolean = false;
        private filename: string = "/home/root/lms2012/prjs/BrkProg_SAVE/" + control.programName() + ".rtf";
        private previousSaveTime: number = 0;
        private savePending: boolean = false;
        private writeInterval: number = 5000;

        constructor() {
        }

        /**
         * Read stored values from file if it exists
         */
        readStoredValues() {
            if (internal.exists(this.filename))
            {
                let lines = internal.read(this.filename).split("\n");
                for (let i = 0; i < lines.length; i++) {
                    let line = lines[i];
                    let sepPos = line.indexOf("=");

                    if (sepPos > 0) {
                        let key = line.substr(0, sepPos).trim();
                        let val = parseInt(line.substr(sepPos + 1), 10);

                        if (!isNaN(val)) {
                            this.data[key] = val;
                        }
                    }
                }
            }
            this.loaded = true;
        }

        /**
         * Save stored values file
         */
        writeStoredValues() {
            let timeNow = control.millis();

            if (timeNow - this.previousSaveTime < this.writeInterval)
            {
                // Do not save too often to avoid flash wear
                if (!this.savePending)
                {
                    this.savePending = true;
                    setTimeout(() => {this.writeStoredValues()}, this.writeInterval);
                }
                return;
            }

            let fileData = "";
            let keys = Object.keys(this.data);
            for (let i = 0; i < keys.length; i++) {
                fileData += keys[i] + "=" + this.data[keys[i]] + "\n";
            }

            internal.overwrite(this.filename, fileData);
            this.savePending = false;
            this.previousSaveTime = timeNow;
        }
    }

    const storedvalues: StoredValues = new StoredValues();

    /**
     * Read a persistent variable
     * @param key Name of the variable, eg: "name"
     */
    //% help=storage/read-value
    //% blockId=storageReadValue
    //% block="read value $key||or default $defaultValue"
    //% weight=85
    //% blockGap=8
    //% inlineInputMode=inline
    //% group="Stored Variables"
    export function readValue(key: string, defaultValue: number = 0): number {
        if (!storedvalues.loaded) storedvalues.readStoredValues();
        let val = storedvalues.data[key];
        return val === undefined ? defaultValue : val;
    }

    /**
     * Write a persistent variable
     * @param key Name of the variable, eg: "name"
     * @param value Value to write
     */
    //% help=storage/write-value
    //% blockId=storageWriteValue
    //% block="write value $key = $value"
    //% weight=85
    //% blockGap=8
    //% inlineInputMode=inline
    //% group="Stored Variables"
    export function writeValue(key: string, value: number = 0) {
        if (!storedvalues.loaded) storedvalues.readStoredValues();
        if (storedvalues.data[key] === value) return;

        storedvalues.data[key] = value;
        storedvalues.writeStoredValues();
    }
}
