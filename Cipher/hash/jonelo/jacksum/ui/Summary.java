/******************************************************************************
 *
 * Jacksum version 1.7.0 - checksum utility in Java
 * Copyright (C) 2001-2006 Dipl.-Inf. (FH) Johann Nepomuk Loefflmann,
 * All Rights Reserved, http://www.jonelo.de
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation; either version 2
 * of the License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 59 Temple Place - Suite 330, Boston, MA  02111-1307, USA.
 *
 * E-mail: jonelo@jonelo.de
 *
 *****************************************************************************/

package jonelo.jacksum.ui;

import jonelo.jacksum.util.Service;

public class Summary {

    private long
            files = 0,
            errorFiles = 0,
            modifiedFiles = 0,
            removedFiles = 0,
            addedFiles = 0,
            dirs = 0,
            begin = 0,
            errorDirs = 0,
            bytes = 0;

    private boolean
            check = false,
            enabled = false;

    public Summary() {
    }

    public void reset() {
        files = 0;
        errorFiles = 0;
        modifiedFiles = 0;
        removedFiles = 0;
        addedFiles = 0;
        dirs = 0;
        begin = 0;
        errorDirs = 0;
        bytes = 0;
        check = false;
        enabled = false;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
        begin = System.currentTimeMillis();
    }

    // Files
    public void setFiles(long files) {
        this.files = files;
    }

    public void addFile() {
        files++;
    }

    public long getFiles() {
        return files;
    }

    public void setErrorFiles(long errorFiles) {
        this.errorFiles = errorFiles;
    }

    public void addErrorFile() {
        errorFiles++;
    }

    public long getErrorFiles() {
        return errorFiles;
    }

    public void setModifiedFiles(long modifiedFiles) {
        this.modifiedFiles = modifiedFiles;
    }

    public long getModifiedFiles() {
        return modifiedFiles;
    }

    public void setRemovedFiles(long removedFiles) {
        this.removedFiles = removedFiles;
    }

    public long getRemovedFiles() {
        return removedFiles;
    }

    public void setAddedFiles(long addedFiles) {
        this.addedFiles = addedFiles;
    }

    public long getAddedFiles(){
        return addedFiles;
    }

    // Bytes
    public void setBytes(long bytes) {
        this.bytes = bytes;
    }

    public long getBytes() {
        return bytes;
    }

    public void addBytes(long bytes) {
        this.bytes += bytes;
    }

    // Dirs
    public void setDirs(long dirs) {
        this.dirs = dirs;
    }

    public void addDir() {
        dirs++;
    }

    public long getDirs() {
        return dirs;
    }

    public void setErrorDirs(long errorDirs) {
        this.errorDirs = errorDirs;
    }

    public void addErrorDir() {
        errorDirs++;
    }

    public long getErrorDirs() {
        return errorDirs;
    }

    public void setCheck(boolean check) {
        this.check = check;
    }

    public boolean isCheck() {
        return check;
    }

    public void print() {
        if (!enabled)
            return;
        long end = System.currentTimeMillis();
        System.err.println();
        if (!isCheck()) {
            System.err.println("Jacksum: processed directories: " + dirs);
            System.err.println("Jacksum: directory read errors: " + errorDirs);
        }

        System.err.println("Jacksum: processed files: " + files);
        System.err.println("Jacksum: processed bytes: " + bytes);
        System.err.println("Jacksum: file read errors: " + errorFiles);

        if (isCheck()) {
            System.err.println("Jacksum: removed files:  " + removedFiles);
            System.err.println("Jacksum: modified files: " + modifiedFiles);
            System.err.println("Jacksum: added files:  " + addedFiles);
        }

        System.err.println("Jacksum: elapsed time: " + Service.duration(end - begin));
    }

}

