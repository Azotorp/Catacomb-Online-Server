#!/bin/bash
while true; do
tput civis -- invisible
clear
echo -e "\e[92mRunning Command: \e[33mnode \e[95mindex.js\e[0m"
echo -e "\e[33mType \e[95mstop \e[33mto close & save server, or Press \e[95mCTRL + A \e[33mthen \e[95mD \e[33mto detach screen.\e[0m"
sleep 1
clear
node index.js
i=10
echo -e "\e[33mPress \e[95mCTRL + C \e[33mto exit run script.\e[0m\n"
while [ $i -gt 0 ]; do
	if [ "$i" -eq 10 ]; then
		COLOR="\e[38;5;12m"
	fi	
	if [ "$i" -eq 9 ]; then
		COLOR="\e[38;5;12m"
	fi	
	if [ "$i" -eq 8 ]; then
		COLOR="\e[38;5;10m"
	fi	
	if [ "$i" -eq 7 ]; then
		COLOR="\e[38;5;10m"
	fi	
	if [ "$i" -eq 6 ]; then
		COLOR="\e[38;5;11m"
	fi	
	if [ "$i" -eq 5 ]; then
		COLOR="\e[38;5;11m"
	fi	
	if [ "$i" -eq 4 ]; then
		COLOR="\e[38;5;13m"
	fi	
	if [ "$i" -eq 3 ]; then
		COLOR="\e[38;5;13m"
	fi	
	if [ "$i" -eq 2 ]; then
		COLOR="\e[38;5;9m"
	fi	
	if [ "$i" -eq 1 ]; then
		COLOR="\e[38;5;1m"
	fi	
	echo -ne "Restarting in: $COLOR$i ...\e[0m\033[0K\r"
	i=$((i-1))
	sleep 1
done
tput cnorm -- normal
clear
done;
