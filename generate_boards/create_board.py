from random import randint, random, shuffle, choice
from uuid import uuid4
from collections import deque
from graphviz import Digraph
import sqlite3


class Letter:
    def __init__(self, val=None, parents=[]):
        self.val = val
        self.id = str(uuid4())[:5]
        self.parents = parents


class Node:
    def __init__(self, word_id, next_n=None, prev_n=None, letter_num=None):
        self.word_id = word_id
        self.next_n = next_n
        self.prev_n = prev_n
        self.letter = Letter()
        self.letter.parents.append(self)
        self.letter_num = letter_num

    def __str__(self):
        return str(self.letter.val) + '.' + str(self.letter_num)


class Word:
    def __init__(self, length):
        self.length = length
        self.word = None
        self.word_id = uuid4()
        prev = None
        for i in range(length):
            # print(length - i + 1)
            new_node = Node(word_id=self.word_id, next_n=prev, letter_num= length - i)
            if prev:
                prev.prev_n = new_node
            prev = new_node
        self.head = prev

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

        self.words = [Word(randint(len_min, len_max)) for _ in range(num_words)]
        self.words.sort(key=lambda x: len(x))
        print([word.length for word in self.words])

        ind = -1
        base = self.words[ind]
        self.heads = [base.head]
        ind -= 1
        while ind >= -len(self.words):
            new_word = self.words[ind]
            self.heads.append(new_word.head)
            probs = [random() for _ in range(new_word.length - 1)]
            num_s = probs.pop()
            num_e = probs.pop()
            probs.append(1)
            shuffle(probs)
            probs = [num_s] + probs + [num_e]
            print(probs)
            start = len(base) - len(new_word)
            word_node = new_word.head
            base_node = base.head
            while start > 0:
                base_node = base_node.next_n
                start -= 1

            while word_node:

                merge = probs.pop()
                if merge >= 0.7 and word_node.letter_num != 1 and word_node.letter_num != new_word.length:
                    word_node.letter = base_node.letter
                    base_node.letter.parents.append(base_node)
                base_node = base_node.next_n
                word_node = word_node.next_n
            ind -= 1

    def visualize_struct(self):
        dot = Digraph()
        edges = []
        search = deque(self.heads)
        searched = set()
        while len(search) > 0:
            node = search.popleft()
            dot.node(str(node))
            if node.next_n and node.next_n not in searched:
                dot.edge(str(node), str(node.next_n), label=f"{str(node.word_id)[:3]}")
                search.append(node.next_n)
                searched.add(node.next_n)
            searched.add(node)
        print(dot.source)
        dot.render(view=True)

    def populate_board(self):
        base = self.words[0]
        valid_words = self.query_db(
            f"SELECT * FROM words WHERE length(word) = {base.length}"
        )
        base_word = choice(valid_words)

        fill_base = base.head
        self.populate_word(fill_base, base_word[0])
        found_words = [base_word[0]]
        print(base_word[0])
        for word in self.words[1:]:
            head = word.head
            position_query = {}
            position = 0
            while head:
                if head.letter.val:
                    position_query[position] = head.letter.val
                position += 1
                head = head.next_n
            query = f"SELECT * FROM words WHERE length(word) = {word.length}"
            for pos, let in position_query.items():
                query += f" AND letter{pos+1} = '{let}' "
            for f_word in found_words:
                query += f" AND word != '{f_word}' "
            query += ";"
            valid_words = self.query_db(query)
            new_word = choice(valid_words)
            print(new_word[0])
            found_words.append(new_word[0])
            self.populate_word(word.head, new_word[0])

    def populate_word(self, word_head, input_word):
        ind = 0
        while word_head:
            if not word_head.letter.val:
                word_head.letter.val = input_word[ind]
            word_head = word_head.next_n
            ind += 1

    def query_db(self, query):
        cursor = self.conn.cursor()
        cursor.execute(query)
        return cursor.fetchall()

    def create_json(self):
        for head in self.heads:
            run = head
            while run:
                # print(run)
                run = run.next_n


def create_cursor():
    con = sqlite3.connect("wordsDict.db")
    return con


def main():
    b = Board(3, 5, 7)
    b.populate_board()
    b.create_json()
    b.visualize_struct()
    b.conn.close()
    # import pdb

    # pdb.set_trace()


if __name__ == "__main__":
    main()
