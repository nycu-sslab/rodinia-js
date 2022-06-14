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

    int row_col_length = atoi(argv[1]);

    std::stringstream ss;

    ss << row_col_length << ".txt";

    std::ofstream outf(ss.str().c_str(), std::ios::out | std::ios::trunc);
    srand(time(NULL));

    for (int i = 0; i < row_col_length; i++)
    {
        outf << (rand() % 10) << " ";
    }
    outf << std::endl;

    for (int i = 0; i < row_col_length; i++)
    {
        outf << (rand() % 10) << " ";
    }
    outf << std::endl;

    outf.close();
}