import sqlite3
import pickle




def create_table(cur):
    sql = """CREATE TABLE words (
   word varchar(32) PRIMARY KEY,
    letter1 varchar(1),
    letter2 varchar(1),
    letter3 varchar(1),
    letter4 varchar(1),
    letter5 varchar(1),
    letter6 varchar(1),
    letter7 varchar(1),
    letter8 varchar(1),
    letter9 varchar(1),
    letter10 varchar(1),
    letter11 varchar(1),
    letter12 varchar(1)
);"""
    cur.execute(sql)
    cur.commit
    

def populate_table(cur):
    statements = []
    with open('fullWordList.csv', 'r') as f:
        lines = f.readlines()
        for word in lines[1:]:
            word = word.strip()
            if len(word) > 3 and len(word) < 13:
                row = [word]
                for letter in word:
                    row.append(letter)
                if len(row) <= 12:
                    for _ in range(13-len(row)):
                        row.append(None)
                    print(len(row))
                statements.append(tuple(row))
    
    # pickle.dump(statements, 'formatted.pickle')
    # print(statements)


    cur.executemany('INSERT INTO words VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);', statements)





def create_cursor():
    con = sqlite3.connect('wordsDict.db')
    return con

def main():
    con = create_cursor()
    # create_table(cur)
    populate_table(con.cursor())
    con.commit()
    con.close()


if __name__ == '__main__':
    main()