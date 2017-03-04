MIDI WEB ROUTER
===============
A router for MIDI signals via your web browser

Requirements:
-------------

Crossbar.IO:
 Crossbar.io is a networking platform for distributed and microservice applications.
    + http://crossbar.io/ 
    + https://github.com/crossbario/crossbar
Installation
------------
It is a good idea to create a virtual environment to run this application.

0. If you don't have virtualenv installed, use the following command to install it:

        pip install virtualenv

1. Create a virtual environment in the folder of your choice

        virtualenv midi_web_router

2. Activate the virtual environment

        . midi_web_router/bin/activate

3. Install crossbar.io

        pip install crossbar

4. Clone this repository:

        git clone https://github.com/jacobanana/midi_web_router.git

Usage
-----

0. Make sure the virtual environment is activated

        . path/to/midi_web_router/bin/activate

1. Start crossbar from the *midi_web_router* directory

        cd path/to/midi_web_router
        crossbar start
        
2. Open your Web MIDI compatible Browser and go to the following address:
   Make sure the MIDI devices you would like to use are connected to the computer before loading the page.

        http://localhost:8080
        or
        http://[ip_address_of_crossbar_server]:8080
  
3. In the *Local Devices* tab, set a *Machine ID* and register the MIDI devices you would like to make available

4. Repeat 2 and 3 on another computer you would like to add to the MIDI network

5. Set your routings using the grid.
   Note that you can only route a single Input device per Output device but you can route the same 
   Input device to multiple outputs.
   
6. Just JAM
