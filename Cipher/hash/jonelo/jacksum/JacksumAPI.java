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

package jonelo.jacksum;

import java.security.NoSuchAlgorithmException;
import java.util.Iterator;
import java.util.Map;
import java.util.TreeMap;
import jonelo.jacksum.algorithm.AbstractChecksum;
import jonelo.jacksum.algorithm.Adler32;
import jonelo.jacksum.algorithm.Adler32alt;
import jonelo.jacksum.algorithm.Cksum;
import jonelo.jacksum.algorithm.Crc16;
import jonelo.jacksum.algorithm.Crc32;
import jonelo.jacksum.algorithm.Crc32Mpeg2;
import jonelo.jacksum.algorithm.Crc64;
import jonelo.jacksum.algorithm.Crc8;
import jonelo.jacksum.algorithm.CrcGeneric;
import jonelo.jacksum.algorithm.Edonkey;
import jonelo.jacksum.algorithm.Elf;
import jonelo.jacksum.algorithm.FCS16;
import jonelo.jacksum.algorithm.FCS32;
import jonelo.jacksum.algorithm.MD;
import jonelo.jacksum.algorithm.MDbouncycastle;
import jonelo.jacksum.algorithm.MDgnu;
import jonelo.jacksum.algorithm.CombinedChecksum;
import jonelo.jacksum.algorithm.MDTree;
import jonelo.jacksum.algorithm.None;
import jonelo.jacksum.algorithm.Read;
import jonelo.jacksum.algorithm.Sum16;
import jonelo.jacksum.algorithm.Sum24;
import jonelo.jacksum.algorithm.Sum32;
import jonelo.jacksum.algorithm.Sum8;
import jonelo.jacksum.algorithm.SumBSD;
import jonelo.jacksum.algorithm.SumSysV;
import jonelo.jacksum.algorithm.Xor8;
import jonelo.sugar.util.GeneralProgram;
import jonelo.sugar.util.GeneralString;
import jonelo.sugar.util.Version;


/**
 * This is the Jacksum Application Program Interface (API).
 * Use this API to get an instance of an algorithm and to
 * determine both the available algorithms and available encodings
 * for the checksum.
 */
public class JacksumAPI {

    public final static String NAME = "Jacksum";
    public final static String VERSION = "1.7.0";


    /**
     * Determines the Version of this API.
     * @return a Version object representing the version of this API
     */
    public final static Version getVersion() {
        return new Version(VERSION);
    }


    /**
     * determines the Version of this API.
     * @return a String representing the Version of this API
     */
    public final static String getVersionString() {
        return VERSION;
    }


    /**
     * determines the Name of this API.
     * @return a String representing the Name of this API
     */
    public final static String getName() {
        return NAME;
    }

    /**
     * runs the CLI     
     */
    public static void runCLI(String[] args) {
        jonelo.jacksum.cli.Jacksum.main(args);
    }
    
    /**
     * Gets all available encodings of a checksum.
     *
     * @return a Map with key and value pairs, both are Strings
     * (the key can be used to feed the method setEncoding(),
     * the value of the pair is a description of the encoding)
     */
    public static Map getAvailableEncodings() {
        Map map = new TreeMap();
        map.put(""             ,"Default");
        map.put("bin"          ,"Binary");
        map.put("dec"          ,"Decimal");
        map.put("oct"          ,"Octal");
        map.put("hex"          ,"Hexadecimal (lowercase)");
        map.put("hexup"        ,"Hexadecimal (uppercase)");
        map.put("base16"       ,"Base 16");
        map.put("base32"       ,"Base 32");
        map.put("base64"       ,"Base 64");
        map.put("bubblebabble" ,"BubbleBabble");
        return map;
    }


    /**
     * Gets all available algorithms.
     *
     * @return a Map with key and value pairs, both are Strings
     * (the key can be used to feed the method getChecksumInstance(),
     * the value of the pair is the name of the algorithm
     * which can be used in a GUI for example)
     */
    public static Map getAvailableAlgorithms() {
        Map map = new TreeMap();
        map.put("adler32"         ,"Adler 32");
        map.put("cksum"           ,"cksum (Unix)");
        map.put("crc8"            ,"CRC-8 (FLAC)");
        map.put("crc16"           ,"CRC-16 (LHA/ARC)");
        map.put("crc24"           ,"CRC-24 (Open PGP)");
        map.put("crc64"           ,"CRC-64 (ISO 3309)");
        map.put("crc32"           ,"CRC-32 (FCS-32)");
        map.put("crc32_mpeg2"     ,"CRC-32 (MPEG-2)");
        map.put("crc32_bzip2"     ,"CRC-32 (BZIP2)");
        map.put("ed2k"            ,"ed2k");
        map.put("elf"             ,"Elf");
        map.put("fcs16"           ,"FCS-16");
        map.put("gost"            ,"GOST (R 34.11-94)");
        map.put("has160"          ,"HAS-160");
        map.put("haval_128_3"     ,"HAVAL 128 (3 rounds)");
        map.put("haval_128_4"     ,"HAVAL 128 (4 rounds)");
        map.put("haval_128_5"     ,"HAVAL 128 (5 rounds)");
        map.put("haval_160_3"     ,"HAVAL 160 (3 rounds)");
        map.put("haval_160_4"     ,"HAVAL 160 (4 rounds)");
        map.put("haval_160_5"     ,"HAVAL 160 (5 rounds)");
        map.put("haval_192_3"     ,"HAVAL 192 (3 rounds)");
        map.put("haval_192_4"     ,"HAVAL 192 (4 rounds)");
        map.put("haval_192_5"     ,"HAVAL 192 (5 rounds)");
        map.put("haval_224_3"     ,"HAVAL 224 (3 rounds)");
        map.put("haval_224_4"     ,"HAVAL 224 (4 rounds)");
        map.put("haval_224_5"     ,"HAVAL 224 (5 rounds)");
        map.put("haval_256_3"     ,"HAVAL 256 (3 rounds)");
        map.put("haval_256_4"     ,"HAVAL 256 (4 rounds)");
        map.put("haval_256_5"     ,"HAVAL 256 (5 rounds)");
        map.put("md2"             ,"MD2");
        map.put("md4"             ,"MD4");
        map.put("md5"             ,"MD5");
        map.put("ripemd128"       ,"RIPEMD-128");
        map.put("ripemd160"       ,"RIPEMD-160");
        map.put("ripemd256"       ,"RIPEMD-256");
        map.put("ripemd320"       ,"RIPEMD-320");
        map.put("sha0"            ,"SHA-0");
        map.put("sha1"            ,"SHA-1 (SHA-160)");
        map.put("sha224"          ,"SHA-2 (SHA-224)");
        map.put("sha256"          ,"SHA-2 (SHA-256)");
        map.put("sha384"          ,"SHA-2 (SHA-384)");
        map.put("sha512"          ,"SHA-2 (SHA-512)");
        map.put("sumbsd"          ,"sum (BSD Unix)");
        map.put("sumsysv"         ,"sum (System V Unix)");
        map.put("sum8"            ,"sum 8");
        map.put("sum16"           ,"sum 16");
        map.put("sum24"           ,"sum 24");
        map.put("sum32"           ,"sum 32");
        map.put("tiger128"        ,"Tiger/128");
        map.put("tiger160"        ,"Tiger/160");
        map.put("tiger"           ,"Tiger (Tiger/192)");
        map.put("tiger2"          ,"Tiger2");
        map.put("tree:tiger"      ,"Tiger Tree Hash");
        map.put("tree:tiger2"     ,"Tiger2 Tree Hash");
        map.put("whirlpool0"      ,"Whirlpool-0");
        map.put("whirlpool1"      ,"Whirlpool-1");
        map.put("whirlpool2"      ,"Whirlpool");
        map.put("xor8"            ,"XOR 8");
        return map;
    }


    /**
     * Gets an object of a checksum algorithm.
     * It always tries to use implementations from the Java API
     *
     * @param algorithm code for the checksum algorithm
     * @return a checksum algorithm object
     * @exception NoSuchAlgorithmException if algorithm is unknown
     */
    public static AbstractChecksum getChecksumInstance(String algorithm)
    throws NoSuchAlgorithmException {
        return getChecksumInstance(algorithm,false);
    }


    /**
     * Gets an object of a checksum algorithm.
     *
     * @param algorithm code for the checksum algorithm
     * @param alternate a pure Java implementation is preferred
     * @return a checksum algorithm object
     * @exception NoSuchAlgorithmException if algorithm is unknown
     */
    public static AbstractChecksum getChecksumInstance(String algorithm, boolean alternate)
    throws NoSuchAlgorithmException {
        AbstractChecksum checksum = null;

        // a combined hash algorithm (must be the first if clause)
        if (algorithm.indexOf("+") > -1) {
            String[] codes = GeneralString.split(algorithm, "+"); // we need compatibility with JRE 1.3
            checksum = new CombinedChecksum(codes, alternate);

        // most popular algorithms first
        } else if (algorithm.equals("sha1") || algorithm.equals("sha") || algorithm.equals("sha-1") ||
            algorithm.equals("sha160") || algorithm.equals("sha-160")) {
            if (alternate) checksum = new MDgnu(jonelo.jacksum.adapt.gnu.crypto.Registry.SHA160_HASH); else
            checksum = new MD("SHA-1");
        } else if (algorithm.equals("crc32") || algorithm.equals("crc-32") ||
            algorithm.equals("fcs32") || algorithm.equals("fcs-32")) {
            if (alternate) checksum = new FCS32(); else
            checksum = new Crc32();
        } else if (algorithm.equals("md5") || algorithm.equals("md5sum")) {
            if (alternate) checksum = new MDgnu(jonelo.jacksum.adapt.gnu.crypto.Registry.MD5_HASH); else
            checksum = new MD("MD5");
        } else if (algorithm.equals("cksum")) {
            checksum = new Cksum();
        } else if (algorithm.equals("sumbsd") || algorithm.equals("bsd") || algorithm.equals("bsdsum")) {
            checksum = new SumBSD();
        } else if (algorithm.equals("sumsysv") || algorithm.equals("sysv") || algorithm.equals("sysvsum")) {
            checksum = new SumSysV();
        } else if (algorithm.equals("adler32") || algorithm.equals("adler-32")) {
            if (alternate) checksum = new Adler32alt(); else
            checksum = new Adler32();
        } else if (algorithm.equals("crc32_mpeg2") || algorithm.equals("crc-32_mpeg-2")) {
            checksum = new Crc32Mpeg2();
        }

        /* we use versions provided by the JRE (supported since 1.4.2) if possible
           see http://java.sun.com/j2se/1.4.2/changes.html#security
           and http://java.sun.com/j2se/1.4.2/docs/guide/security/CryptoSpec.html#AppA
         */
          else if (algorithm.equals("sha256") || algorithm.equals("sha-256")) {
            if (alternate) checksum = new MDgnu(jonelo.jacksum.adapt.gnu.crypto.Registry.SHA256_HASH); else
            if (GeneralProgram.isSupportFor("1.4.2"))
                checksum = new MD("SHA-256"); else
                checksum = new MDgnu(jonelo.jacksum.adapt.gnu.crypto.Registry.SHA256_HASH);
        } else if (algorithm.equals("sha384") || algorithm.equals("sha-384")) {
            if (alternate) checksum = new MDgnu(jonelo.jacksum.adapt.gnu.crypto.Registry.SHA384_HASH); else
            if (GeneralProgram.isSupportFor("1.4.2"))
                checksum = new MD("SHA-384"); else
                checksum = new MDgnu(jonelo.jacksum.adapt.gnu.crypto.Registry.SHA384_HASH);
        } else if (algorithm.equals("sha512") || algorithm.equals("sha-512")) {
            if (alternate) checksum = new MDgnu(jonelo.jacksum.adapt.gnu.crypto.Registry.SHA512_HASH); else
            if (GeneralProgram.isSupportFor("1.4.2"))
                checksum = new MD("SHA-512"); else
                checksum = new MDgnu(jonelo.jacksum.adapt.gnu.crypto.Registry.SHA512_HASH);
        } else if (algorithm.equals("sha224") || algorithm.equals("sha-224")) {
            checksum = new MDgnu(jonelo.jacksum.adapt.gnu.crypto.Registry.SHA224_HASH);
        } else if (algorithm.equals("tiger")  || algorithm.equals("tiger192")  || algorithm.equals("tiger-192")) {
            checksum = new MDgnu(jonelo.jacksum.adapt.gnu.crypto.Registry.TIGER_HASH);
        } else if (algorithm.equals("tree:tiger")) {
            checksum = new MDTree("tiger");
        } else if (algorithm.equals("tree:tiger2")) {
            checksum = new MDTree("tiger2");
        } else if (algorithm.equals("tiger160")  || algorithm.equals("tiger-160")) {
            checksum = new MDgnu(jonelo.jacksum.adapt.gnu.crypto.Registry.TIGER160_HASH);
        } else if (algorithm.equals("tiger128")  || algorithm.equals("tiger-128")) {
            checksum = new MDgnu(jonelo.jacksum.adapt.gnu.crypto.Registry.TIGER128_HASH);
        } else if (algorithm.equals("tiger2")) {
            checksum = new MDgnu(jonelo.jacksum.adapt.gnu.crypto.Registry.TIGER2_HASH);
        } else if (algorithm.startsWith("haval")) {
            checksum = new MDgnu(algorithm);
        } else if (algorithm.equals("crc16") || algorithm.equals("crc-16")) {
            checksum = new Crc16();
        } else if (algorithm.equals("ripemd160") || algorithm.equals("ripemd-160") || algorithm.equals("ripe-md160") ||
                   algorithm.equals("rmd160") || algorithm.equals("rmd-160")) {
            checksum = new MDgnu(jonelo.jacksum.adapt.gnu.crypto.Registry.RIPEMD160_HASH);
        } else if (algorithm.equals("ripemd128") || algorithm.equals("ripemd-128") || algorithm.equals("ripe-md128") ||
                   algorithm.equals("rmd128") || algorithm.equals("rmd-128")) {
            checksum = new MDgnu(jonelo.jacksum.adapt.gnu.crypto.Registry.RIPEMD128_HASH);
        } else if (algorithm.equals("ripemd256") || algorithm.equals("ripemd-256") || algorithm.equals("ripe-md256") ||
                   algorithm.equals("rmd256") || algorithm.equals("rmd-256")) {
            checksum = new MDbouncycastle("ripemd256");
        } else if (algorithm.equals("ripemd320") || algorithm.equals("ripemd-320") || algorithm.equals("ripe-md320") ||
                   algorithm.equals("rmd320") || algorithm.equals("rmd-320")) {
            checksum = new MDbouncycastle("ripemd320");
        } else if (algorithm.equals("whirlpool0") || algorithm.equals("whirlpool-0")) {
            checksum = new MDgnu(jonelo.jacksum.adapt.gnu.crypto.Registry.WHIRLPOOL2000_HASH);
        } else if (algorithm.equals("whirlpool1") || algorithm.equals("whirlpool-1")) {
            checksum = new MDgnu(jonelo.jacksum.adapt.gnu.crypto.Registry.WHIRLPOOL_HASH);
        } else if (algorithm.equals("whirlpool2") || algorithm.equals("whirlpool-2") || algorithm.equals("whirlpool")) {
            checksum = new MDgnu(jonelo.jacksum.adapt.gnu.crypto.Registry.WHIRLPOOL2003_HASH);

        } else if (algorithm.equals("crc64") || algorithm.equals("crc-64")) {
            checksum = new Crc64();
        } else if (algorithm.equals("ed2k") || algorithm.equals("emule") || algorithm.equals("edonkey")) {
            checksum = new Edonkey();
        } else if (algorithm.equals("md4") || algorithm.equals("md4sum")) {
            checksum = new MDgnu(jonelo.jacksum.adapt.gnu.crypto.Registry.MD4_HASH);
        } else if (algorithm.equals("md2") || algorithm.equals("md2sum")) {
            checksum = new MDgnu(jonelo.jacksum.adapt.gnu.crypto.Registry.MD2_HASH);
        } else if (algorithm.equals("sha0") || algorithm.equals("sha-0")) {
            checksum = new MDgnu(jonelo.jacksum.adapt.gnu.crypto.Registry.SHA0_HASH);
        } else if (algorithm.equals("elf") || algorithm.equals("elf32") || algorithm.equals("elf-32")) {
            checksum = new Elf();
        } else if (algorithm.equals("fcs16") || algorithm.equals("fcs-16") ||
                   algorithm.equals("crc16_x25") || algorithm.equals("crc-16_x-25")) {
            checksum = new FCS16();
        } else if (algorithm.equals("crc8") || algorithm.equals("crc-8")) {
            checksum = new Crc8();
        } else if (algorithm.equals("crc24") || algorithm.equals("crc-24")) {
            checksum = new CrcGeneric(24, 0x864CFB, 0xB704CEL, false, false, 0);
        } else if (algorithm.equals("sum8") || algorithm.equals("sum-8")) {
            checksum = new Sum8();
        } else if (algorithm.equals("sum16") || algorithm.equals("sum-16")) {
            checksum = new Sum16();
        } else if (algorithm.equals("sum24") || algorithm.equals("sum-24")) {
            checksum = new Sum24();
        } else if (algorithm.equals("sum32") || algorithm.equals("sum-32")) {
            checksum = new Sum32();
        } else if (algorithm.equals("xor8") || algorithm.equals("xor-8")) {
            checksum = new Xor8();
        } else if (algorithm.equals("gost")) {
            checksum = new MDbouncycastle("gost");
        } else if (algorithm.equals("crc32_bzip2") || algorithm.equals("crc-32_bzip-2")) {
            checksum = new CrcGeneric(32, 0x04C11DB7, 0xFFFFFFFFL, false, false, 0xFFFFFFFFL);
        } else if (algorithm.equals("has160") || algorithm.equals("has-160")) {
            checksum = new MDgnu(jonelo.jacksum.adapt.gnu.crypto.Registry.HAS160_HASH);
        // special algorithms
        } else if (algorithm.equals("none")) {
            checksum = new None();
        } else if (algorithm.equals("read")) {
            checksum = new Read();

        // the generic CRC
        } else if (algorithm.startsWith("crc:")) {
            checksum = new CrcGeneric(algorithm.substring(4));
        // all algorithms
        } else if (algorithm.equals("all")) {

           Map map = JacksumAPI.getAvailableAlgorithms();
           Iterator iterator = map.entrySet().iterator();           
           String[] codes = new String[map.entrySet().size()];
           int i = 0;
           StringBuffer allNames = new StringBuffer();
           while (iterator.hasNext()) {
               Map.Entry entry = (Map.Entry)iterator.next();
               // String description = (String)entry.getValue();
               String name = ((String)entry.getKey());
               allNames.append(name);
               allNames.append("+");
               codes[i++]=name;
           }
           checksum = new CombinedChecksum(codes, alternate);
           allNames.deleteCharAt(allNames.length()-1);
           algorithm = allNames.toString();
        } else { // unknown
            throw new NoSuchAlgorithmException(algorithm+" is an unknown algorithm.");
        }
        checksum.setName(algorithm);
        return checksum;
    }

}
