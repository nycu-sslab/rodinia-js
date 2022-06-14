#include <iostream>
#include <fstream>
#include <sstream>
#include <cstdlib>
#include <cstring>
#include <ctime>

int main(int argc, char *argv[])
{
    if (argc != 2)
    {
        std::cout << "Usage: ./gen <number>";
        exit(1);
    }

    int length = atoi(argv[1]);

    std::stringstream ss;

    ss << length << ".txt";

    std::ofstream outf(ss.str().c_str(), std::ios::out | std::ios::trunc);
    srand(time(NULL));

    for (int i = 0; i < length; i++)
    {
        outf << 0.0001 * (rand() % 100) << " ";
    }
    outf << std::endl;

    outf.close();
}