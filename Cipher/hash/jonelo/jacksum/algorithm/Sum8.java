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

public class Sum8 extends AbstractChecksum {

    public Sum8() {
        super();
        value = 0;
    }

    public void reset() {
        value = 0;
        length = 0;
    }

    public void update(byte b) {
        value += b & 0xFF;
        length++;
    }

    public void update(int b) {
        value += b & 0xFF;
        length++;
    }

    public long getValue() {
        return value % 256;
    }

    public byte[] getByteArray() {
        return new byte[]
         {(byte)(getValue()&0xff)};
    }


}

/*
    Testvectors from the PC Magazin 06/1996:

    decimal:
      36 211 163 4 109 192 58 247 47 92 => 135
    hex:
      24 D3 A3 04 6D C0 3A F7 2F 5C => 87
 */
