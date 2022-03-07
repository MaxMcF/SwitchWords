from random import randint, random, shuffle, choice
from uuid import uuid4
from collections import deque
from graphviz import Digraph
import sqlite3
from retrying import retry
from itertools import product


class Letter:
    def __init__(self, val=None, start=False, end=False):
        self.val = val
        self.id = str(uuid4())[:5]
        self.ismerge = False
        self.start = start
        self.end = end

    def __str__(self):
        return str(self.val) + '.' + self.id

class Word:
    def __init__(self, length, game_length, offset, word=None):
        self.length = length
        self.game_length = game_length
        self.offset = offset
        self.word = word
        self.word_id = uuid4()
        self.letters = []
        first = True
        counter = 1
        for i in range(game_length):
            if offset > 0:
                self.letters.append(None)
                offset -= 1
            elif i >= length + self.offset:
                self.letters.append(None)
            else:
                if first:
                    self.letters.append(Letter(start=True))
                    first = False
                elif counter == length + self.offset:
                    self.letters.append(Letter(end=True))
                else:
                    self.letters.append(Letter())
            counter += 1
        print(['' if not letter else (letter.start, letter.end) for letter in self.letters])
        print(length)

    def __len__(self):
        return self.length

    def __str__(self):
        return self.word if self.word else ""

    def set_word(self, word):
        assert len(word) == self.length
        self.word = word


class Board:
    def __init__(
        self,
        num_words,
        len_min,
        len_max,
        max_ol_rate=0.5,
        min_ol_rate=0.5,
        len_vari=None,
        bidir=False,
        cyclic=False,
    ):
        self.conn = create_cursor()

        if len_vari:
            len_min = randint(len_min, len_max - len_vari)
            len_max = rand_range_start + len_vari
        self.words = []

        word_lengths = sorted([randint(len_min, len_max) for _ in range(num_words)])

        self.game_length = max(word_lengths)
        base_word = word_lengths[-1]
       
        base_word_obj = Word(length=base_word, game_length=self.game_length, offset=0)
        self.words.append(base_word_obj)

        for length in word_lengths[:-1]:
            probs = self.gen_probs(length)
            print(probs)
            diff_len = randint(0, base_word - length)
            word_obj = Word(length=length, game_length=self.game_length, offset=diff_len)
            first = True
            offset = 0
            for i, (let, let_b) in enumerate(zip(word_obj.letters, base_word_obj.letters)):
                if not let:
                    offset += 1
                else:
                    merge_prob = probs.pop()
                    if merge_prob >= 0.7 and not first and i != length + offset - 1:
                        word_obj.letters[i] = base_word_obj.letters[i]
                    if first:
                        first = False
            self.words.append(word_obj)

    def gen_probs(self, length):
        """
        Game constraint: Each word should have its own independent head, and independent tail.
        """
        probs = [random() for _ in range(length-1)]
        num_s = probs.pop()
        num_e = probs.pop()
        probs.append(1)
        shuffle(probs)
        return [num_s] + probs + [num_e]

    def visualize_struct(self):
        dot = Digraph()
        edges = []
        searched = set()
        print([word.word for word in self.words])
        for word in self.words:
            letter_cleaned = [word for word in word.letters if word]
            for letter in letter_cleaned:
                dot.node(str(letter), label=letter.val)
            for i in range(len(word.letters[:-1])):
                if word.letters[i] and word.letters[i+1]:
                    dot.edge(str(word.letters[i]), str(word.letters[i+1]), label=f"{word.word}")
        # print(dot.source)
        dot.render(view=True)


    def populate_board(self):
        base = self.words[0]
        valid_words = self.query_db(
            f"SELECT * FROM words WHERE length(word) = {base.length}"
        )
        base_word_row = choice(valid_words)
        base_word = base_word_row[0]
        self.words[0].word = base_word
        i = 0
        for letter in self.words[0].letters:
            if letter:
                letter.val = base_word[i]
                i += 1            


        found_words = [base_word]
        ignore_position_query = {}
        for word in self.words[1:]:
            position_query = {}
            i = 0
            for letter in word.letters:
                if letter:
                    if letter in self.words[0].letters:
                        position_query[i+1] = letter.val
                    i += 1

            query = f"SELECT * FROM words WHERE length(word) = {word.length}"
            for pos, let in position_query.items():
                query += f" AND letter{pos} = '{let}' "
            for pos, let in ignore_position_query.items():
                query += f" AND letter{pos} != '{let}' "
            for f_word in found_words:
                query += f" AND word != '{f_word}' "
            query += ";"
            valid_words = self.query_db(query)
            new_word = choice(valid_words)
            found_words.append(new_word[0])
            word.word = new_word[0]

            i = 0
            for letter in word.letters:
                if letter:
                    letter.val = new_word[0][i]
                    i += 1  
            
            i = 0
            for letter in word.letters:
                if letter:
                    if letter in self.words[0].letters:
                        ignore_position_query[i+1] = letter.val
                    i += 1


    def query_db(self, query):
        cursor = self.conn.cursor()
        cursor.execute(query)
        return cursor.fetchall()

    def merge_letters(self):
        for i in range(self.game_length):
            for j, k in product(range(len(self.words)), range(len(self.words))):
                if j != k and self.words[j].letters[i] and self.words[k].letters[i]:
                    print(j, k)
                    if self.words[j].letters[i].val == self.words[k].letters[i].val:
                        if not self.words[j].letters[i].start and not self.words[j].letters[i].end:
                            if not self.words[k].letters[i].start and not self.words[k].letters[i].end:
                                print(self.words[j].letters[i],  self.words[k].letters[i])
                                self.words[j].letters[i] = self.words[k].letters[i]
                    
                

    # def create_json(self):
    #     for head in self.heads:
    #         run = head
    #         while run:
    #             # print(run)
    #             run = run.next_n


def create_cursor():
    con = sqlite3.connect("wordsDict.db")
    return con


def main():
    b = Board(3, 5, 7)

    b.populate_board()

    # b.create_json()
    # b.visualize_struct()
    b.merge_letters()
    b.visualize_struct()
    # b.conn.close()
    # import pdb

    # pdb.set_trace()


if __name__ == "__main__":
    main()
