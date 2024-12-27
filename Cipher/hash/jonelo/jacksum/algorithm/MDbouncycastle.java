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
 * MDgnu is a wrapper class for accessing MessageDigests from the
 * GNU crypto project http://www.gnu.org/software/classpathx/crypto
 *
 *****************************************************************************/
package jonelo.jacksum.algorithm;

import java.security.NoSuchAlgorithmException;
import jonelo.jacksum.adapt.org.bouncycastle.crypto.Digest;
import jonelo.jacksum.adapt.org.bouncycastle.crypto.digests.GOST3411Digest;
import jonelo.jacksum.adapt.org.bouncycastle.crypto.digests.RIPEMD256Digest;
import jonelo.jacksum.adapt.org.bouncycastle.crypto.digests.RIPEMD320Digest;

/**
 * A wrapper class that can be used to compute GOST, RIPEMD256 and RIPEMD320
 * (provided by bouncycastle.org).
 */
public class MDbouncycastle extends AbstractChecksum {
    
    private Digest md = null;
    private boolean virgin=true;
    private byte[] digest = null;
    
    /** Creates new MDbouncycastle */
    public MDbouncycastle(String arg) throws NoSuchAlgorithmException {
        // value0; we don't use value, we use md
        length = 0;
        filename = null;
        separator = " ";
        encoding = HEX;
        virgin = true;
        if (arg.equalsIgnoreCase("gost"))
            md = new GOST3411Digest(); else
        if (arg.equalsIgnoreCase("ripemd256"))
            md = new RIPEMD256Digest(); else
        if (arg.equalsIgnoreCase("ripemd320"))
            md = new RIPEMD320Digest(); else
        throw new NoSuchAlgorithmException(arg + " is an unknown algorithm.");
    }
    
    public void reset() {
        md.reset();
        length = 0;
        virgin = true;
    }
    
    public void update(byte[] buffer, int offset, int len) {
        md.update(buffer, offset, len);
        length += len;
    }
    
    public void update(byte b) {
        md.update(b);
        length++;
    }
    
    public void update(int b) {
        update((byte)(b & 0xFF));
    }
    
    public String toString() {
        return getFormattedValue() +separator+
                (isTimestampWanted()? getTimestampFormatted()+separator:"")+
                getFilename();
    }
    
    public byte[] getByteArray() {
        if (virgin) {
            digest=new byte[md.getDigestSize()];
            md.doFinal(digest,0);
            //digest=md.digest();
            virgin=false;
        }
        // we don't expose internal representations
        byte[] save = new byte[digest.length];
        System.arraycopy(digest,0,save,0,digest.length);
        return save;
    }
    
}
