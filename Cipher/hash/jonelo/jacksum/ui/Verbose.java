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

/**
 * This class stores the verbose states.
 * It controls the output of Warnings and Details and wheather a summary is printed.
 */
public class Verbose {

  private boolean warnings;
  private boolean details;
  private boolean summary;

  /**
   * Constructs a verbose object.
   */
  public Verbose() {
     reset();
  }

  /**
   * Resets all verbose states to a default.
   * Warnings and Details are enabled, Summary is disabled.
   */
  public void reset() {
     warnings=true;
     details=true;
     summary=false;
  }

  /**
   * Sets the warning state.
   *
   * @param warnings are warnings wanted?
   */
  public void setWarnings(boolean warnings) {
      this.warnings=warnings;
  }

  /**
   * Gets the warning state.
   *
   * @return are warnings wanted?
   */
  public boolean getWarnings() {
      return warnings;
  }

  /**
   * Sets the details state.
   *
   * @param details are details wanted?
   */
  public void setDetails(boolean details) {
      this.details=details;
  }

  /**
   * Gets the details state.
   *
   * @return are details wanted?
   */
  public boolean getDetails() {
      return details;
  }

  /**
   * Sets the summary state.
   *
   * @param summary is a summary wanted?
   */
  public void setSummary(boolean summary) {
      this.summary=summary;
  }

  /**
   * Gets the summary state.
   *
   * @return is a summary wanted?
   */
  public boolean getSummary() {
      return summary;
  }


}
