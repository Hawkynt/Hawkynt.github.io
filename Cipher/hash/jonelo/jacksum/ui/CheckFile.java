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

import java.io.BufferedReader;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileNotFoundException;
import java.io.IOException;
import java.io.InputStreamReader;
import java.security.NoSuchAlgorithmException;
import java.util.NoSuchElementException;
import jonelo.jacksum.JacksumAPI;
import jonelo.jacksum.algorithm.AbstractChecksum;
import jonelo.jacksum.algorithm.Edonkey;
import jonelo.jacksum.algorithm.MD;
import jonelo.jacksum.algorithm.MDgnu;
import jonelo.jacksum.algorithm.None;
import jonelo.jacksum.algorithm.Read;
import jonelo.sugar.util.EncodingException;
import jonelo.sugar.util.ExitException;
import jonelo.sugar.util.GeneralString;

/**
 * This class can be used to check the file integrity of files against a given file list.
 */
public class CheckFile {
    
    /** Lines starting with this special String are ignored */
    public final static String COMMENTDEFAULT = JacksumAPI.NAME + ": Comment:";
    
    private String CSEP = "\t"; // default separator for the checkfile
    private String checkFile = null;
    private MetaInfo metaInfo = null;
    private AbstractChecksum checksum = null;
    private boolean _l = false;
    private Verbose verbose = null;
    private Summary summary = null;
    private long removed = 0;
    private long modified = 0;
    private String workingDir = null;
    
    
    /**
     * Creates a CheckFile.
     *
     * @param checkFile a file containing filenames and their checksums
     * and in best case meta-information
     */
    public CheckFile(String checkFile) {
        this.checkFile = checkFile;
    }
    
    /**
     * Sets meta-information.
     * This meta-information is the fallback if the checkFile doesn't contain
     * meta-information.
     *
     * @param metInfo the MetaInfo object, it contains information
     *                about the format of the records.
     * @see #perform()
     */
    public void setMetaInfo(MetaInfo metaInfo) {
        this.metaInfo = metaInfo;
    }
    
    /**
     * Gets meta-information.
     *
     * @return the MetaInfo object.
     */
    public MetaInfo getMetaInfo() {
        return metaInfo;
    }
    
    /**
     * Sets the verbose object containing the verbose level.
     *
     * @param verbose the Verbose object.
     */
    public void setVerbose(Verbose verbose) {
        this.verbose = verbose;
    }
    
    /**
     * Determines what verbose level is wanted.
     *
     * @return the verbose object containing the verbose level
     */
    public Verbose getVerbose() {
        return verbose;
    }
    
    /**
     * Sets the summary object containing all data for the summary.
     *
     * @param summary the Summary object.
     */
    public void setSummary(Summary summary) {
        this.summary = summary;
        summary.setCheck(true);
    }
    
    /**
     * Get the Summary object.
     *
     * @return the Summary object containing all data for the summary
     */
    public Summary getSummary() {
        return summary;
    }


    /**
     * Sets the list value.
     *
     * @param list the boolean state whether a list is wanted.
     */
    public void setList(boolean list) {
        this._l = list;
    }
    
    /**
     * Determines whether a short list is wanted.
     *
     * @return the boolean state whether a list is wanted.
     */
    public boolean isList() {
        return _l;
    }
    
    public long getModified() {
        return modified;
    }
    
    public long getRemoved() {
        return removed;
    }

    public void setWorkingDir(String workingDir) {
        this.workingDir = workingDir;
    }
    
    public String getWorkingDir(){
        return workingDir;
    }
    
    /**
     * Reads the file which has been specified at the constructor.
     * The file is read and info about modifications are printed out.
     * The output is controlled by the set methods of this class.
     *
     * @exception FileNotFoundException if file is not there
     * @exception IOException during an IO error
     * @exception MetaInfoVersionException if the MetaInfo version is incompatible
     */
    public void perform() throws FileNotFoundException, IOException, MetaInfoVersionException, ExitException {
        // read the checkFile line by line
        
        FileInputStream fis = null;
        InputStreamReader isr = null;
        BufferedReader br = null;
        
        try {
            fis = new FileInputStream(checkFile);
            isr = new InputStreamReader(fis);
            br = new BufferedReader(isr);
            br.mark(1024);
            
            String thisLine = null;
            int ignoretokens = 2; // default: checksum and filesize
            String filename = null;
            
            if ((thisLine = br.readLine()) != null) {
                if (thisLine.startsWith(MetaInfo.METAINFO) &&
                    !thisLine.startsWith(metaInfo.getCommentchars())) {
                    
                    // read the Meta Information from the file
                    metaInfo = new MetaInfo(thisLine);
                    
                } else {
                    if (verbose.getWarnings()) { 
                        System.err.println("Jacksum: Warning: file does not contain meta information. Please set suitable command line parameters.");
                    }
                    // let's use the current metaInfo
                    // the first line wasn't a meta info line, so let's start reading from the beginning
                    br.reset();
                }
            } else {
                throw new ExitException("File is empty.\nExit.", ExitStatus.CHECKFILE);
            }
            
            
            try {
                checksum = JacksumAPI.getChecksumInstance(metaInfo.getAlgorithm(), metaInfo.isAlternate());
            } catch (NoSuchAlgorithmException nsae) {
                throw new ExitException(nsae.getMessage(), ExitStatus.CHECKFILE);
            }
            
            if (checksum instanceof MD || 
                    checksum instanceof MDgnu ||
                    checksum instanceof Edonkey) {
                ignoretokens--; // no size value
            }
            
            if (checksum instanceof None || 
                    checksum instanceof Read)
                ignoretokens--; // no checksum value
            
            
            if (metaInfo.isSeparatorWanted()) {
                CSEP = metaInfo.getSeparator();
                checksum.setSeparator(CSEP);
            } else { // otherwise, we use the default separator which dependent on the algorithm
                CSEP = checksum.getSeparator();
            }
            
            // is there a timeformat?
            if (metaInfo.isTimestampFormat()) {
                ignoretokens++;
                checksum.setTimestampFormat(metaInfo.getTimestampFormat());
                // if CSEP is part of tformat, increase ignoretokens (count CSEPs)
                String[] result = GeneralString.split(metaInfo.getTimestampFormat(), CSEP);
                ignoretokens += result.length - 1;
            } else {
                checksum.setTimestampFormat(null);
            }
            
            if (metaInfo.isGrouping()) {
                checksum.setGroup(metaInfo.getGrouping());
                checksum.setGroupChar(metaInfo.getGroupChar());
            } else {
                checksum.setGroup(0);
            }
            
            if (metaInfo.isEncoding()) {
                try {
                    checksum.setEncoding(metaInfo.getEncoding());
                } catch (EncodingException e) {
                    if (verbose.getWarnings()) System.err.println("Jacksum: Warning: "+e.getMessage());
                }
            }
            
            // find out the length of the checksum output
            // skip the checksum token if length is predictable
            int skipchecksumlen = 0;
            if (
                    (checksum.getEncoding().length() == 0) || // it's decimal => actual the length is unpredictable
                    (checksum.getEncoding().equalsIgnoreCase(AbstractChecksum.DEC)) || // decimal
                    (checksum.getEncoding().equalsIgnoreCase(AbstractChecksum.OCT)) || // octal
                    (checksum instanceof None || checksum instanceof Read) // no checksum
                ) {
                skipchecksumlen = 0;
            } else {
                skipchecksumlen = checksum.getFormattedValue().length();
                ignoretokens--; // we ignore the checksum by it's length and not by the token
            }
            
            
            // process the check file
            String folder = "";
            boolean lastLineWasEmptyLine = true;
            while ((thisLine = br.readLine()) != null) {
                if (
                        (!thisLine.startsWith(COMMENTDEFAULT)) && // ignore Jacksum default comment lines
                        (!thisLine.startsWith(metaInfo.getCommentchars())) // ignore customized comment lines
                        ) {
                    if (thisLine.length() == 0) { // ignore empty lines
                        lastLineWasEmptyLine = true;
                        continue;
                    }
                    if (thisLine.startsWith(JacksumAPI.NAME)) {
                        if (verbose.getWarnings()) {
                            System.err.println(JacksumAPI.NAME + ": Warning: Ignoring unknown directive.");
                        }
                    } else {
                        
                        if (lastLineWasEmptyLine && 
                                metaInfo.isRecursive() && 
                                !metaInfo.isPathInfo() && 
                                thisLine.endsWith(":")) { // it is a folder
                            lastLineWasEmptyLine = false;
                            folder = thisLine.substring(0,thisLine.length()-1);
                            
                            if (workingDir != null && workingDir.length() > 0) {
                                folder = workingDir + metaInfo.getFilesep() + folder;
                            }
                            
                            if (File.separatorChar != metaInfo.getFilesep()) {
                                folder = folder.replace(metaInfo.getFilesep(), File.separatorChar);
                            }

                            if (!_l) {
                                System.out.println("\n"+folder+":");
                            }
                            if (folder.length() > 0) {
                                folder += File.separator;
                            }
                        } else { // it is a record
                            try {
                                filename = parseFilename(thisLine, ignoretokens, skipchecksumlen);
                                int skip = filename.length();

                                if (metaInfo.isPathInfo() && workingDir != null && workingDir.length() > 0){
                                    folder = workingDir + metaInfo.getFilesep();
                                    skip += folder.length();
                                }
                               
                                if (File.separatorChar != metaInfo.getFilesep()) {
                                    filename = filename.replace(metaInfo.getFilesep(), File.separatorChar);
                                }
                                
                                if (_l) {
                                    skipOkFiles(folder+filename, thisLine, skip);
                                } else {
                                    System.out.print(whatChanged(folder+filename, thisLine, skip));
                                    System.out.println(filename);
                                }
                            } catch (NoSuchElementException e) {
                                if (verbose.getWarnings()) System.err.println(JacksumAPI.NAME+": Warning: Invalid entry: "+thisLine);
                            } catch (IOException ioe) {
                                summary.addErrorFile();
                                String detail = null;
                                if (verbose.getDetails()) {
                                    detail = filename+" ["+ioe.getMessage()+"]";
                                } else {
                                    detail = filename;
                                }
                                System.err.println("Jacksum: Error: "+detail);
                            }
                        }
                    }
                } // if
                
            } // while
            
        } finally {
            // save the statistics
            summary.setRemovedFiles(removed);
            summary.setModifiedFiles(modified);
            // release file descriptors
            if (br != null) br.close();
            if (isr != null) isr.close();
            if (fis != null) fis.close();
        }
    }
    
    private void skipOkFiles(String filename, String thisLine, int skip) throws IOException {
        boolean out = false;
        if (!(new File(filename).exists())) {
            removed++;
            out = true;
        } else {
            String output = getChecksumOutput(filename);
            if (!output.regionMatches(0,thisLine,0,output.length()-skip)) {
                out = true;
                modified++;
            }
        }
        if (out) System.out.println(filename);
        summary.addFile();
    }
    
    private String whatChanged(String filename, String thisLine, int skip) throws IOException {
        if (!(new File(filename).exists())) {
            removed++;
            summary.addFile();
            return("[REMOVED] ");
        } else {
            String output = getChecksumOutput(filename);
            if (!output.regionMatches(0,thisLine,0,output.length()-skip)) {
                modified++;
                summary.addFile();
                return("[FAILED]  ");
            } else {
                summary.addFile();
                return("[OK]      ");
            }
        }
    }
    
    private String parseFilename(String thisLine, int ignoretokens, int skipchecksumlen)
    throws NoSuchElementException {
        // get the filename from thisLine
        if (skipchecksumlen > 0) {
            thisLine = thisLine.substring(skipchecksumlen+CSEP.length());
        }
        
        StringBuffer buf = new StringBuffer();
        String[] result = GeneralString.split(thisLine,CSEP);
        //String filename=result[ignoretokens];
        buf.append(result[ignoretokens]); // filename
        for (int i = ignoretokens+1; i < result.length; i++) {
            buf.append(CSEP);
            buf.append(result[i]);
        }
        return buf.toString();
    }
    
    /** get a formatted checksum line
     * @return a full formatted checksum line
     * @param filename process this file
     */
    private String getChecksumOutput(String filename) throws IOException  {
        summary.addBytes(checksum.readFile(filename, true));
        
        File f = new File(filename);
        if (metaInfo.isRecursive() && !metaInfo.isPathInfo()) checksum.setFilename(f.getName());
        else checksum.setFilename(filename);
        //return  (_F ? checksum.format(format) : checksum.toString());
        return checksum.toString();
    }
    
}
