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
package jonelo.jacksum.cli;

import java.io.BufferedReader;
import java.io.FileNotFoundException;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import jonelo.jacksum.JacksumAPI;
import jonelo.jacksum.ui.ExitStatus;
import jonelo.sugar.util.ExitException;

/**
 *
 * @author jonelo
 */
public class JacksumHelp {

    /**
     * print Jacksum's program version
     * @return version number
     */
    public static void printVersion() {
        System.out.println(JacksumAPI.NAME+" "+JacksumAPI.VERSION);
    }

    /** print the GPL information and an OSI certified note to stdout */
    public static void printGPL() {
        System.out.println("\n "+JacksumAPI.NAME+" v"+JacksumAPI.VERSION+", Copyright (C) 2002-2006, Dipl.-Inf. (FH) Johann N. Loefflmann\n");
        System.out.println(" "+JacksumAPI.NAME+" comes with ABSOLUTELY NO WARRANTY; for details see 'license.txt'.");
        System.out.println(" This is free software, and you are welcome to redistribute it under certain");
        System.out.println(" conditions; see 'license.txt' for details.");
        System.out.println(" This software is OSI Certified Open Source Software.");
        System.out.println(" OSI Certified is a certification mark of the Open Source Initiative.\n");
        System.out.println(" Go to http://www.jonelo.de/java/jacksum/index.html to get the latest version.\n");
    }

    /** print GPL info and a short help */
    public static void printHelpShort() throws ExitException {
        printGPL();
        System.out.println(" For more information please type:");
        System.out.println(" java -jar jacksum.jar -h en");
        System.out.println("\n Fuer weitere Informationen bitte eingeben:");
        System.out.println(" java -jar jacksum.jar -h de\n");
        throw new ExitException(null, ExitStatus.OK);
    }

    /**
     * print the documentation
     * @param filename the flat file containing the documentation
     */
    public static void printHelpLong(String filename, String search) throws FileNotFoundException, IOException {
        InputStream is = null;
        InputStreamReader isr = null;
        BufferedReader br = null;

        try {
            is = Jacksum.class.getResourceAsStream(filename);
            if (is==null) throw new FileNotFoundException(filename);
            isr = new InputStreamReader(is);
            br = new BufferedReader(isr);
            String line;
            if (search==null) {
              while ((line = br.readLine()) != null) {
                  System.out.println(line);
              }
            } else {
              StringBuffer sb= new StringBuffer();
              boolean found=false;
              while ((line = br.readLine()) != null) {

                  // put lines to buffer
                  if (line.length()==0) {
                      // put out old buffer
                      if (found && sb.length() > 0) System.out.println(sb.toString());
                      // new chance
                      found=false;
                      // new buffer
                      sb=new StringBuffer();
                  } else {
                      sb.append(line);
                      sb.append('\n');
                      if (!found &&
                        (
                          (line.length() > 18 && line.substring(0,18).trim().toLowerCase().startsWith(search)) ||
                          (line.toLowerCase().startsWith(search))
                        )
                      ) {
                          found=true;
                      }
                  }

              } // end-while
            } // end-if
        } finally {
            if (br != null) br.close();
            if (isr != null) isr.close();
            if (is != null) is.close();
        } // end-try
    }

    public static void help(String code, String search) throws ExitException {
        String filename="/help/jacksum/help_"+code+".txt";
        int exitcode=ExitStatus.OK;
        try {
            printHelpLong(filename, search);
        } catch (FileNotFoundException fnfe) {
            System.err.println("Helpfile "+filename+" not found.");
            exitcode=ExitStatus.PARAMETER;
        } catch (IOException ioe) {
            System.err.println("Problem while reading helpfile "+filename);
            exitcode=ExitStatus.PARAMETER;
        }
        throw new ExitException (null, exitcode);
    }
}
