namespace pxsim.storage {

    // Virtual file system for the browser simulator (Filename -> Content string)
    export let virtualFS: { [filename: string]: string } = {};

    export function __stringToBuffer(s: string): RefBuffer {
        if (!s) return pxsim.BufferMethods.createBuffer(0);
        // Convert a standard JavaScript string to a Uint8Array for the simulator
        let encoder = new globalThis.TextEncoder();
        return new RefBuffer(encoder.encode(s));
    }

    export function __bufferToString(b: RefBuffer): string {
        if (!b || !b.data || b.data.length === 0) return "";
        // Decode the simulator's byte array back into a standard JavaScript string
        let decoder = new globalThis.TextDecoder();
        return decoder.decode(b.data);
    }

    export function __mkdir(fn: string) {
        // Directories are simulated flat in the JS object, no action needed
    }

    export function __unlink(filename: string): void { 
        // Delete the file from the virtual file system
        delete virtualFS[filename];
    }

    export function __truncate(filename: string): void { 
        // Clear or initialize an empty file
        virtualFS[filename] = "";
    }

    /**
     * Factory function to create a fully working MMapImpl structure.
     * This prevents the simulator from returning default -1 values for file operations.
     */
    export function createMMapImpl(filename: string): pxsim.MMapMethods.MMapImpl {
        return {
            data: new Uint8Array([]),
            lseek: (offset: number, whence: number): number => {
                // SeekWhence.End (usually 2) is used to query the file size
                if (whence === 2) {
                    let text = virtualFS[filename] || "";
                    let encoder = new globalThis.TextEncoder();
                    return encoder.encode(text).length; // Return actual byte length instead of -1
                }
                return 0; // Seek to the beginning of the file
            },
            read: (buf: RefBuffer): number => {
                let text = virtualFS[filename] || "";
                let encoder = new globalThis.TextEncoder();
                let uint8 = encoder.encode(text);
                if (buf && buf.data) {
                    buf.data = uint8; // Copy the file data into the provided read buffer
                }
                return uint8.length;
            },
            write: (buf: RefBuffer): number => {
                if (!buf || !buf.data) return 0;
                let decoder = new globalThis.TextDecoder();
                let text = decoder.decode(buf.data);
                // Append text data to our virtual file storage
                virtualFS[filename] = (virtualFS[filename] || "") + text;
                return buf.data.length;
            }
        };
    }
}

namespace pxsim.MMapMethods {
    
    // Keep a reference to the original registry object
    const originalRegistry = mmapRegistry;

    /**
     * Registry Hack using a JavaScript Proxy object.
     * Intercepts `mmapRegistry[filename]` access from core `control.mmap` implementation.
     * If MakeCode asks for an unregistered custom user file, we dynamically inject 
     * a working MMapImpl instance to prevent RangeError (-1) crashes.
     */
    (pxsim.MMapMethods as any).mmapRegistry = new Proxy(originalRegistry, {
        get: function(target, filename: string) {
            // If the core platform doesn't have a native simulation for this file name, 
            // supply our custom file simulation logic instead of a blank stub.
            if (!target[filename] && typeof filename === "string") {
                target[filename] = pxsim.storage.createMMapImpl(filename);
            }
            return target[filename];
        }
    });
}