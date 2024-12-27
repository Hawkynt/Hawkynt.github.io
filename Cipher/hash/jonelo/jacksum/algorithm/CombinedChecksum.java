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

package jonelo.jacksum.algorithm;

import java.io.BufferedInputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.security.NoSuchAlgorithmException;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Vector;
import jonelo.jacksum.JacksumAPI;
import jonelo.jacksum.util.Service;
import jonelo.sugar.util.EncodingException;
import jonelo.sugar.util.GeneralString;

/**
 * @author jonelo
 */
public class CombinedChecksum extends AbstractChecksum {

    private Vector algorithms;

    /**
     * Creates a new instance of CombinedChecksum
     */
    public CombinedChecksum() {
        init();
    }

    public CombinedChecksum(String[] algos, boolean alternate) throws NoSuchAlgorithmException {
        init();
        setAlgorithms(algos, alternate);
    }

    private void init() {
        algorithms = new Vector();
        length = 0;
        filename = null;
        separator = " ";
        encoding = HEX;
    }

    public void addAlgorithm(String algorithm, boolean alternate) throws NoSuchAlgorithmException {
        AbstractChecksum checksum = JacksumAPI.getChecksumInstance(algorithm, alternate);
        checksum.setName(algorithm);
        algorithms.add(checksum);
    }

    public void setAlgorithms(String[] algos, boolean alternate) throws NoSuchAlgorithmException {
        for (int i=0; i < algos.length; i++) {
           addAlgorithm(algos[i], alternate);
        }
    }

    public void reset() {
        // for all algorithms
        for (int i=0; i < algorithms.size(); i++) {
            ((AbstractChecksum)algorithms.elementAt(i)).reset();
        }
        length = 0;
    }

    /**
     * Updates all checksums with the specified byte.
     */
    public void update(int b) {
        for (int i=0; i < algorithms.size(); i++) {
            ((AbstractChecksum)algorithms.elementAt(i)).update(i);
        }
        length++;
    }

    /**
     * Updates all checksums with the specified byte.
     */
    public void update(byte b) {
        for (int i=0; i < algorithms.size(); i++) {
            ((AbstractChecksum)algorithms.elementAt(i)).update(b);
        }
        length++;
    }

    /**
     * Updates all checksums with the specified array of bytes.
     */
    public void update(byte[] bytes, int offset, int length) {
        for (int i=0; i < algorithms.size(); i++) {
            ((AbstractChecksum)algorithms.elementAt(i)).update(bytes, offset, length);
        }
        this.length += length;
    }

    /**
     * Updates all checksums with the specified array of bytes.
     */
    public void update(byte[] bytes) {
        for (int i=0; i < algorithms.size(); i++) {
            ((AbstractChecksum)algorithms.elementAt(i)).update(bytes);
        }
        this.length += bytes.length;
    }

    /**
     * Returns the result of the computation as byte array.
     */
    public byte[] getByteArray() {
        Vector v = new Vector();
        int size = 0;
        for (int i=0; i < algorithms.size(); i++) {
            byte[] tmp = ((AbstractChecksum)algorithms.elementAt(i)).getByteArray();
            v.add (tmp);
            size += tmp.length;
        }
        byte[] ret = new byte[size];
        int offset = 0;
        for (int i=0; i < v.size(); i++) {
            byte[] src = (byte[])v.elementAt(i);
            System.arraycopy(src, 0, ret, offset, src.length);
            offset += src.length;
        }
        return ret;
    }

    /**
     * with this method the format() method can be customized, it will be launched at the beginning of format()
     */
    public void firstFormat(StringBuffer formatBuf) {

        // normalize the checksum code token
        GeneralString.replaceAllStrings(formatBuf, "#FINGERPRINT", "#CHECKSUM");

        // normalize the output of every algorithm
        setEncoding(encoding);

        StringBuffer buf = new StringBuffer();
        String format = formatBuf.toString();

        if (format.indexOf("#CHECKSUM{i}") > -1 || format.indexOf("#ALGONAME{i}") > -1) {

            for (int i=0; i < algorithms.size(); i++) {
                StringBuffer line = new StringBuffer(format);
                GeneralString.replaceAllStrings(line, "#CHECKSUM{i}",
                        ((AbstractChecksum)algorithms.elementAt(i)).getFormattedValue() );
                GeneralString.replaceAllStrings(line, "#ALGONAME{i}",
                        ((AbstractChecksum)algorithms.elementAt(i)).getName() );
                buf.append(line);
                if (algorithms.size() > 1) buf.append("\n");
            }
        } else {
            buf.append(format);
        }

        // are there still tokens to be transformed ?
        if (buf.toString().indexOf("#CHECKSUM{") > -1) {
            // replace CHECKSUM{1} to {CHECKSUM{n}
            for (int i=0; i < algorithms.size(); i++) {
                 GeneralString.replaceAllStrings(buf, "#CHECKSUM{"+i+"}",
                        ((AbstractChecksum)algorithms.elementAt(i)).getFormattedValue() );
            }
        }

        if (buf.toString().indexOf("#ALGONAME{") > -1) {
            // replace ALGONAME{1} to {ALGONAME{n}
            for (int i=0; i < algorithms.size(); i++) {
                GeneralString.replaceAllStrings(buf, "#ALGONAME{"+i+"}",
                        ((AbstractChecksum)algorithms.elementAt(i)).getName() );
            }
        }
        formatBuf.setLength(0);
        formatBuf.append(buf.toString());
    }

    /**
     * Sets the encoding of the checksum.
     *
     * @param encoding the encoding of the checksum.
     */
    public void setEncoding(String encoding) throws EncodingException {
         for (int i=0; i < algorithms.size(); i++) {
            ((AbstractChecksum)algorithms.elementAt(i)).setEncoding(encoding);
        }
        this.encoding = ((AbstractChecksum)algorithms.elementAt(0)).getEncoding();
    }

}
