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

// http://www.faqs.org/rfcs/rfc1950.html
//
// Adler-32 is composed of two sums accumulated per byte: s1 is
// the sum of all bytes, s2 is the sum of all s1 values. Both sums
// are done modulo 65521. s1 is initialized to 1, s2 to zero. The
// Adler-32 checksum is stored as s2*65536 + s1 in most-
// significant-byte first (network) order.

package jonelo.jacksum.algorithm;
/**
 * A class that can be used to compute the Adler32 of a data stream (alternate).
 * This is a 100% Java implementation.
 */

public class Adler32alt extends AbstractChecksum {

    private static final long BASE = 65521L; // largest prime smaller than 65536

    public Adler32alt() {
        super();
        reset();
    }

    public void reset() {
        value = 1L;
        length = 0;
    }

    public void update(byte[] buffer, int offset, int len) {
        long s1 = value & 0xffff;
        long s2 = (value >> 16) & 0xffff;

        for (int n=offset; n < len + offset; n++) {
            s1 = (s1 + (buffer[n] & 0xff)) % BASE;
            s2 = (s2 + s1)                 % BASE;
        }

        value = (s2 << 16) | s1;
        length+=len;
    }

    public void update(byte b) {
        update(new byte[]{b}, 0, 1);
    }

    public void update(int b) {
        update((byte)(b & 0xFF));
    }

    public byte[] getByteArray() {
        long val = getValue();
        return new byte[]
        {(byte)((val>>24)&0xff),
         (byte)((val>>16)&0xff),
         (byte)((val>>8)&0xff),
         (byte)(val&0xff)};
    }

}
